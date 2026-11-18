
import { NextRequest, NextResponse } from "next/server";
import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_API_URL = (
  process.env.ML_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/+$/, "");

const MAX_BODY_BYTES = 24_000;
const MAX_INVENTORY_ITEMS = 200;
const ML_TIMEOUT_MS = 90_000;

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: responseHeaders }
  );
}

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatContext =
  | "general"
  | "advice"
  | "ideas"
  | "shopping"
  | "waste";

type ChatRequest = {
  message: string;
  history: Message[];
  context?: ChatContext;
};

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function validBody(value: unknown): value is ChatRequest {
  return (
    isRecord(value) &&
    Object.keys(value).every((key) =>
      ["message", "history", "context"].includes(key)
    ) &&
    (
      value.context === undefined ||
      (
        typeof value.context === "string" &&
        ["general", "advice", "ideas", "shopping", "waste"].includes(
          value.context
        )
      )
    ) &&
    typeof value.message === "string" &&
    value.message.trim().length > 0 &&
    value.message.length <= 1000 &&
    Array.isArray(value.history) &&
    value.history.length <= 8 &&
    value.history.every(
      (message) =>
        isRecord(message) &&
        Object.keys(message).every((key) =>
          ["role", "content"].includes(key)
        ) &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.length > 0 &&
        message.content.length <= 1500
    )
  );
}

function isValidInventoryItem(
  item: InventoryItem
): boolean {
  return (
    typeof item.id === "string" &&
    typeof item.name === "string" &&
    item.name.length <= 150 &&
    typeof item.unit === "string" &&
    item.unit.length <= 30 &&
    Number.isFinite(item.current_stock) &&
    item.current_stock >= 0 &&
    Number.isFinite(item.minimum_stock) &&
    item.minimum_stock >= 0
  );
}

async function readLimitedBody(
  request: NextRequest
): Promise<{ ok: true; body: string } | { ok: false }> {
  if (!request.body) {
    return { ok: false };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      totalBytes += value.byteLength;

      if (totalBytes > MAX_BODY_BYTES) {
        await reader.cancel();
        return { ok: false };
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return {
      ok: true,
      body: new TextDecoder("utf-8", { fatal: true }).decode(combined),
    };
  } catch {
    return { ok: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    // 2. Origin verification
    const configuredOrigin =
      process.env.APP_ORIGIN ??
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "");

    let allowedOrigin: string;

    try {
      const url = new URL(configuredOrigin);

      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      ) {
        throw new Error("Invalid origin");
      }

      allowedOrigin = url.origin;
    } catch {
      return jsonError(
        "Konfigurasi APP_ORIGIN tidak valid.",
        500
      );
    }

    if (request.headers.get("origin") !== allowedOrigin) {
      return jsonError("Origin request tidak diizinkan.", 403);
    }

    // 3. Content-Type
    const contentType =
      request.headers.get("content-type") ?? "";

    if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
      return jsonError(
        "Content-Type harus application/json.",
        415
      );
    }

    // 4. Declared body size
    const contentLength = request.headers.get("content-length");

    if (contentLength !== null) {
      if (!/^\d+$/.test(contentLength)) {
        return jsonError(
          "Content-Length tidak valid.",
          400
        );
      }

      if (Number(contentLength) > MAX_BODY_BYTES) {
        return jsonError(
          "Ukuran request terlalu besar.",
          413
        );
      }
    }

    // 5. Stream body size limit
    const rawBody = await readLimitedBody(request);

    if (!rawBody.ok) {
      return jsonError(
        "Ukuran request terlalu besar atau format teks tidak valid.",
        413
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody.body);
    } catch {
      return jsonError("Format JSON tidak valid.", 400);
    }

    if (!validBody(body)) {
      return jsonError(
        "Pesan atau riwayat percakapan tidak valid.",
        400
      );
    }

    // 6. Read trusted inventory from the server
    const { data, error } = await supabaseAdmin
      .from("inventory_current_stock")
      .select(
        "id, name, unit, current_stock, minimum_stock"
      )
      .is("archived_at", null)
      .order("id")
      .limit(MAX_INVENTORY_ITEMS + 1);

    const inventory: InventoryItem[] = (data ?? [])
      .slice(0, MAX_INVENTORY_ITEMS)
      .map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        current_stock: Number(item.current_stock),
        minimum_stock: Number(item.minimum_stock),
      }));

    const inventoryValid =
      !error &&
      inventory.every(isValidInventoryItem);

    const inventoryStatus = !inventoryValid
      ? "unavailable"
      : (data?.length ?? 0) > MAX_INVENTORY_ITEMS
        ? "partial"
        : "complete";

    // 7. Call ML backend
    const controller = AbortSignal.timeout(ML_TIMEOUT_MS);

    let response: Response;

    try {
      response = await fetch(`${ML_API_URL}/rag/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: body.message.trim(),
          history: body.history,
          context: body.context ?? "general",
          inventory: inventoryValid ? inventory : [],
          inventory_status: inventoryStatus,
        }),
        cache: "no-store",
        signal: AbortSignal.any([
          request.signal,
          controller,
        ]),
      });
    } catch (error) {
      if (request.signal.aborted) {
        return jsonError(
          "Permintaan dibatalkan.",
          499
        );
      }

      if (
        error instanceof Error &&
        error.name === "TimeoutError"
      ) {
        return jsonError(
          "Bready membutuhkan waktu terlalu lama untuk menjawab. Silakan coba lagi nanti.",
          504
        );
      }

      console.error(
        "Bready ML backend connection failed:",
        error instanceof Error ? error.name : "UnknownError"
      );

      return jsonError(
        "Layanan AI belum dapat dihubungi. Pastikan backend aktif.",
        503
      );
    }

    // 8. Handle backend errors
    if (!response.ok) {
      if (response.status === 503 || response.status === 504) {
        return jsonError(
          "Layanan AI sedang mengalami gangguan sementara. Silakan coba lagi nanti.",
          503
        );
      }

      if (response.status === 429) {
        return jsonError(
          "Permintaan AI sedang terlalu banyak. Silakan coba beberapa saat lagi.",
          429
        );
      }

      console.error(
        "Bready ML backend returned:",
        response.status
      );

      return jsonError(
        "Bready belum bisa memproses pesan. Silakan coba lagi.",
        502
      );
    }

    // 9. Validate backend response
    let answer: unknown;

    try {
      answer = await response.json();
    } catch {
      return jsonError(
        "Respons dari layanan AI tidak valid.",
        502
      );
    }

    if (
      !isRecord(answer) ||
      typeof answer.answer !== "string" ||
      !answer.answer.trim() ||
      answer.answer.length > 12000 ||
      ![null, "predict", "rag"].includes(
        answer.action as null | string
      ) ||
      !(
        answer.item_id === null ||
        (
          typeof answer.item_id === "string" &&
          inventoryValid &&
          inventory.some(
            (item) => item.id === answer.item_id
          )
        )
      ) ||
      !(
        answer.lead_time_days === null ||
        (
          typeof answer.lead_time_days === "number" &&
          Number.isInteger(answer.lead_time_days) &&
          answer.lead_time_days >= 1 &&
          answer.lead_time_days <= 365
        )
      )
    ) {
      return jsonError(
        "Format jawaban Bready tidak valid. Silakan coba lagi.",
        502
      );
    }

    // 10. Context restriction
    if (body.context && body.context !== "general") {
      answer.action = null;
      answer.item_id = null;
      answer.lead_time_days = null;
    }

    return NextResponse.json(
      {
        success: true,
        data: answer,
      },
      {
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error(
      "Bready chat request failed:",
      error instanceof Error ? error.name : "UnknownError"
    );

    return jsonError(
      "Bready belum dapat menjawab saat ini. Silakan coba lagi nanti.",
      503
    );
  }
}
