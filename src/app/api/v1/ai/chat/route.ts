
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
const MAX_USAGE_TRANSACTIONS = 10_000;
const TRANSACTION_PAGE_SIZE = 1_000;
const USAGE_PERIOD_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
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

type DataQuality = "insufficient" | "limited" | "adequate";

type StockStatus = "Restock" | "Sufficient" | "Excess";

type InventoryItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  stock_status: StockStatus;
  data_quality: DataQuality;
  lead_time_days: number | null;
  average_daily_usage: number | null;
  average_daily_waste: number | null;
  usage_count: number | null;
  usage_days: number | null;
  usage_period_days: number | null;
};

type UsageTransaction = {
  item_id: string;
  quantity: number | string;
  created_at: string;
};

type UsageMetrics = {
  totalUsage: number;
  usageCount: number;
  usageDays: number;
  averageDailyUsage: number;
  dataQuality: DataQuality;
};

type UsageQueryResult = {
  transactions: UsageTransaction[];
  available: boolean;
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
        [
          "general",
          "advice",
          "ideas",
          "shopping",
          "waste",
        ].includes(value.context)
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
    item.name.length > 0 &&
    item.name.length <= 150 &&
    (
      item.category === null ||
      (
        typeof item.category === "string" &&
        item.category.length <= 50
      )
    ) &&
    typeof item.unit === "string" &&
    item.unit.length > 0 &&
    item.unit.length <= 30 &&
    Number.isFinite(item.current_stock) &&
    item.current_stock >= 0 &&
    Number.isFinite(item.minimum_stock) &&
    item.minimum_stock >= 0 &&
    [
      "Restock",
      "Sufficient",
      "Excess",
    ].includes(item.stock_status) &&
    [
      "insufficient",
      "limited",
      "adequate",
    ].includes(item.data_quality) &&
    (
      item.lead_time_days === null ||
      (
        Number.isInteger(item.lead_time_days) &&
        item.lead_time_days >= 1 &&
        item.lead_time_days <= 365
      )
    ) &&
    (
      item.average_daily_usage === null ||
      (
        Number.isFinite(item.average_daily_usage) &&
        item.average_daily_usage >= 0
      )
    ) &&
    item.average_daily_waste === null &&
    (
      item.usage_count === null ||
      (
        Number.isInteger(item.usage_count) &&
        item.usage_count >= 0 &&
        item.usage_count <= MAX_USAGE_TRANSACTIONS
      )
    ) &&
    (
      item.usage_days === null ||
      (
        Number.isInteger(item.usage_days) &&
        item.usage_days >= 0 &&
        item.usage_days <= USAGE_PERIOD_DAYS
      )
    ) &&
    (
      item.usage_period_days === null ||
      (
        Number.isInteger(item.usage_period_days) &&
        item.usage_period_days === USAGE_PERIOD_DAYS
      )
    ) &&
    (
      item.usage_count === null ||
      item.usage_days === null ||
      item.usage_days <= item.usage_count
    ) &&
    (
      item.usage_count !== null ||
      (
        item.usage_days === null &&
        item.average_daily_usage === null &&
        item.usage_period_days === null
      )
    )
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

function getDataQuality(usageDays: number): DataQuality {
  if (usageDays < 2) {
    return "insufficient";
  }

  if (usageDays < 5) {
    return "limited";
  }

  return "adequate";
}

function calculateUsageMetrics(
  transactions: UsageTransaction[]
): UsageMetrics {
  let totalUsage = 0;
  let usageCount = 0;

  const usageDates = new Set<string>();

  for (const transaction of transactions) {
    const quantity = Number(transaction.quantity);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      typeof transaction.created_at !== "string"
    ) {
      continue;
    }

    const date = new Date(transaction.created_at);

    if (Number.isNaN(date.getTime())) {
      continue;
    }

    totalUsage += quantity;
    usageCount += 1;

    // Konsisten menggunakan tanggal kalender UTC.
    usageDates.add(date.toISOString().slice(0, 10));
  }

  const usageDays = usageDates.size;

  return {
    totalUsage,
    usageCount,
    usageDays,
    averageDailyUsage: Number(
      (totalUsage / USAGE_PERIOD_DAYS).toFixed(4)
    ),
    dataQuality: getDataQuality(usageDays),
  };
}

async function getUsageTransactions(
  itemIds: string[],
  startDate: string,
  endDate: string
): Promise<UsageQueryResult> {
  if (itemIds.length === 0) {
    return {
      transactions: [],
      available: true,
    };
  }

  const transactions: UsageTransaction[] = [];

  try {
    let offset = 0;

    // Mengambil maksimal 10.001 baris.
    // Baris ke-10.001 menjadi penanda bahwa data terpotong.
    while (offset <= MAX_USAGE_TRANSACTIONS) {
      const pageSize = Math.min(
        TRANSACTION_PAGE_SIZE,
        MAX_USAGE_TRANSACTIONS + 1 - offset
      );

      const { data, error } = await supabaseAdmin
        .from("stock_transactions")
        .select("item_id, quantity, created_at")
        .in("item_id", itemIds)
        .eq("transaction_type", "usage")
        .gte("created_at", startDate)
        .lt("created_at", endDate)
        .order("created_at", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (error) {
        console.error(
          "Bready usage query failed:",
          error.code
        );

        return {
          transactions: [],
          available: false,
        };
      }

      const rows = (data ?? []) as UsageTransaction[];

      transactions.push(...rows);

      if (rows.length < pageSize) {
        break;
      }

      offset += rows.length;
    }

    if (transactions.length > MAX_USAGE_TRANSACTIONS) {
      console.warn(
        "Bready usage query exceeded the transaction limit."
      );

      return {
        transactions: [],
        available: false,
      };
    }

    return {
      transactions,
      available: true,
    };
  } catch (error) {
    console.error(
      "Bready usage query exception:",
      error instanceof Error ? error.name : "UnknownError"
    );

    return {
      transactions: [],
      available: false,
    };
  }
}

function getStockStatus(
  currentStock: number,
  minimumStock: number
): StockStatus {
  // Belum ada maximum_stock, sehingga status Excess
  // tidak boleh disimpulkan dari data yang tersedia.
  return currentStock <= minimumStock
    ? "Restock"
    : "Sufficient";
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
      (
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : ""
      );

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
      return jsonError(
        "Origin request tidak diizinkan.",
        403
      );
    }

    // 3. Content-Type
    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !/^application\/json(?:\s*;|$)/i.test(contentType)
    ) {
      return jsonError(
        "Content-Type harus application/json.",
        415
      );
    }

    // 4. Declared body size
    const contentLength =
      request.headers.get("content-length");

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
      return jsonError(
        "Format JSON tidak valid.",
        400
      );
    }

    if (!validBody(body)) {
      return jsonError(
        "Pesan atau riwayat percakapan tidak valid.",
        400
      );
    }

    // 6. Read trusted current inventory from Supabase
    const {
      data: inventoryData,
      error: inventoryError,
    } = await supabaseAdmin
      .from("inventory_current_stock")
      .select(
        "id, name, category, unit, current_stock, minimum_stock"
      )
      .is("archived_at", null)
      .order("id")
      .limit(MAX_INVENTORY_ITEMS + 1);

    const inventoryRows = inventoryData ?? [];

    const inventoryPartial =
      !inventoryError &&
      inventoryRows.length > MAX_INVENTORY_ITEMS;

    const selectedInventory = inventoryRows.slice(
      0,
      MAX_INVENTORY_ITEMS
    );

    // 7. Define rolling 30-day observation window
    const now = new Date();

    const periodStart = new Date(
      now.getTime() -
        USAGE_PERIOD_DAYS * DAY_IN_MS
    );

    const startDate = periodStart.toISOString();
    const endDate = now.toISOString();

    // 8. Read actual usage transactions
    const usageResult: UsageQueryResult = inventoryError
      ? {
          transactions: [],
          available: false,
        }
      : await getUsageTransactions(
          selectedInventory.map((item) => item.id),
          startDate,
          endDate
        );

    // 9. Group usage transactions by item
    const usageByItem = new Map<
      string,
      UsageTransaction[]
    >();

    for (const transaction of usageResult.transactions) {
      const existing =
        usageByItem.get(transaction.item_id) ?? [];

      existing.push(transaction);

      usageByItem.set(
        transaction.item_id,
        existing
      );
    }

    // 10. Build trusted inventory context
    const inventory: InventoryItem[] = selectedInventory.map(
      (item) => {
        const currentStock = Number(item.current_stock);
        const minimumStock = Number(item.minimum_stock);

        const usageTransactions =
          usageByItem.get(item.id) ?? [];

        const metrics = calculateUsageMetrics(
          usageTransactions
        );

        const usageAvailable = usageResult.available;

        return {
          id: item.id,
          name: item.name,
          category: item.category ?? null,
          unit: item.unit,
          current_stock: currentStock,
          minimum_stock: minimumStock,
          stock_status: getStockStatus(
            currentStock,
            minimumStock
          ),
          data_quality: usageAvailable
            ? metrics.dataQuality
            : "insufficient",
          lead_time_days: null,
          average_daily_usage: usageAvailable
            ? metrics.averageDailyUsage
            : null,
          average_daily_waste: null,
          usage_count: usageAvailable
            ? metrics.usageCount
            : null,
          usage_days: usageAvailable
            ? metrics.usageDays
            : null,
          usage_period_days: usageAvailable
            ? USAGE_PERIOD_DAYS
            : null,
        };
      }
    );

    // 11. Validate inventory before sending to ML
    const inventoryValid =
      !inventoryError &&
      inventory.every(isValidInventoryItem);

    const inventoryStatus = !inventoryValid
      ? "unavailable"
      : inventoryPartial
        ? "partial"
        : "complete";

    if (inventoryError) {
      console.error(
        "Bready inventory query failed:",
        inventoryError.code
      );
    }

    // 12. Call ML backend
    const timeoutSignal = AbortSignal.timeout(
      ML_TIMEOUT_MS
    );

    let response: Response;

    try {
      response = await fetch(
        `${ML_API_URL}/rag/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: body.message.trim(),
            history: body.history,
            context: body.context ?? "general",
            inventory: inventoryValid
              ? inventory
              : [],
            inventory_status: inventoryStatus,
          }),
          cache: "no-store",
          signal: AbortSignal.any([
            request.signal,
            timeoutSignal,
          ]),
        }
      );
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
        error instanceof Error
          ? error.name
          : "UnknownError"
      );

      return jsonError(
        "Layanan AI belum dapat dihubungi. Pastikan backend aktif.",
        503
      );
    }

    // 13. Handle backend errors
    if (!response.ok) {
      if (
        response.status === 503 ||
        response.status === 504
      ) {
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

    // 14. Validate backend response
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
      answer.answer.length > 12_000 ||
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

    // 15. Context restriction
    if (
      body.context &&
      body.context !== "general"
    ) {
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
      error instanceof Error
        ? error.name
        : "UnknownError"
    );

    return jsonError(
      "Bready belum dapat menjawab saat ini. Silakan coba lagi nanti.",
      503
    );
  }
}
