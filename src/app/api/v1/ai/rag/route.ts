
import { NextRequest, NextResponse } from "next/server";

import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ML_API_URL =
  process.env.ML_API_URL ?? "http://127.0.0.1:8000";

const WINDOW_DAYS = 30;
const MAX_BODY_BYTES = 4096;
const PAGE_SIZE = 500;
const MAX_TRANSACTIONS = 10000;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

type StockStatus = "Restock" | "Sufficient" | "Excess";

type DataQuality = "insufficient" | "limited" | "adequate";

type RAGRequest = {
  item_id: string;
  lead_time_days: number;
};

type MLResponse = {
  stock_status: StockStatus;
  confidence: number;
};

type RAGResponse = {
  summary: string;
};

type Transaction = {
  transaction_type: string;
  quantity: number;
  created_at: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers: responseHeaders }
  );
}

function isValidRequest(value: unknown): value is RAGRequest {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    Object.keys(data).length === 2 &&
    typeof data.item_id === "string" &&
    UUID_REGEX.test(data.item_id) &&
    typeof data.lead_time_days === "number" &&
    Number.isSafeInteger(data.lead_time_days) &&
    data.lead_time_days >= 1 &&
    data.lead_time_days <= 365
  );
}

function isValidStock(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function isMLResponse(value: unknown): value is MLResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    ["Restock", "Sufficient", "Excess"].includes(
      String(data.stock_status)
    ) &&
    typeof data.confidence === "number" &&
    Number.isFinite(data.confidence) &&
    data.confidence >= 0 &&
    data.confidence <= 1
  );
}

function isRAGResponse(value: unknown): value is RAGResponse {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const data = value as Record<string, unknown>;

  return (
    typeof data.summary === "string" &&
    data.summary.trim().length > 0
  );
}

async function getTransactions(
  itemId: string,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];

  for (
    let offset = 0;
    offset < MAX_TRANSACTIONS;
    offset += PAGE_SIZE
  ) {
    const { data, error } = await supabaseAdmin
      .from("stock_transactions")
      .select("transaction_type, quantity, created_at")
      .eq("item_id", itemId)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .in("transaction_type", ["usage", "waste"])
      .order("created_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new Error("Gagal mengambil riwayat transaksi.");
    }

    const rows = data ?? [];

    for (const row of rows) {
      const quantity = Number(row.quantity);
      const createdAt = new Date(row.created_at);

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(createdAt.getTime()) ||
        !["usage", "waste"].includes(row.transaction_type)
      ) {
        throw new Error("Data transaksi tidak valid.");
      }

      transactions.push({
        transaction_type: row.transaction_type,
        quantity,
        created_at: createdAt.toISOString(),
      });
    }

    if (rows.length < PAGE_SIZE) {
      return transactions;
    }
  }

  throw new Error("Riwayat transaksi terlalu banyak.");
}

function calculateFeatures(transactions: Transaction[]) {
  let totalUsage = 0;
  let totalWaste = 0;
  let usageCount = 0;

  const usageDays = new Set<string>();

  for (const transaction of transactions) {
    if (transaction.transaction_type === "usage") {
      totalUsage += transaction.quantity;
      usageCount++;
      usageDays.add(transaction.created_at.slice(0, 10));
    } else if (transaction.transaction_type === "waste") {
      totalWaste += transaction.quantity;
    }
  }

  let dataQuality: DataQuality = "adequate";

  if (usageCount === 0) {
    dataQuality = "insufficient";
  } else if (usageCount < 5 || usageDays.size < 3) {
    dataQuality = "limited";
  }

  return {
    averageDailyUsage: totalUsage / WINDOW_DAYS,
    averageDailyWaste: totalWaste / WINDOW_DAYS,
    dataQuality,
  };
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
      return jsonError("Konfigurasi APP_ORIGIN tidak valid.", 500);
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

    // 4. Body validation
    const declaredLength = Number(
      request.headers.get("content-length")
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BODY_BYTES
    ) {
      return jsonError("Ukuran request terlalu besar.", 413);
    }

    const rawBody = await request.text();

    if (
      new TextEncoder().encode(rawBody).byteLength >
      MAX_BODY_BYTES
    ) {
      return jsonError("Ukuran request terlalu besar.", 413);
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError("Format JSON tidak valid.", 400);
    }

    if (!isValidRequest(body)) {
      return jsonError(
        "item_id atau lead_time_days tidak valid.",
        400
      );
    }

    // 5. Fetch actual inventory
    const { data: item, error: itemError } =
      await supabaseAdmin
        .from("inventory_current_stock")
        .select(
          "id, name, category, unit, current_stock, minimum_stock"
        )
        .eq("id", body.item_id)
        .is("archived_at", null)
        .maybeSingle();

    if (itemError) {
      throw new Error("Gagal mengambil data inventory.");
    }

    if (!item) {
      return jsonError("Item aktif tidak ditemukan.", 404);
    }

    const currentStock = Number(item.current_stock);
    const minimumStock = Number(item.minimum_stock);

    if (
      !isValidStock(currentStock) ||
      !isValidStock(minimumStock)
    ) {
      return jsonError("Data stok tidak valid.", 422);
    }

    // 6. Transaction history
    const now = new Date();

    const start = new Date(
      now.getTime() - WINDOW_DAYS * 24 * 60 * 60 * 1000
    );

    const transactions = await getTransactions(
      body.item_id,
      start.toISOString(),
      now.toISOString()
    );

    const {
      averageDailyUsage,
      averageDailyWaste,
      dataQuality,
    } = calculateFeatures(transactions);

    // 7. Predict with existing ML service
    let mlResponse: Response;

    try {
      mlResponse = await fetch(`${ML_API_URL}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          current_stock: currentStock,
          minimum_stock: minimumStock,
          average_daily_usage: averageDailyUsage,
          average_daily_waste: averageDailyWaste,
          lead_time_days: body.lead_time_days,
        }),
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
    } catch {
      return jsonError("Layanan prediksi AI tidak tersedia.", 503);
    }

    if (!mlResponse.ok) {
      return jsonError("Layanan prediksi AI gagal.", 502);
    }

    let mlData: unknown;

    try {
      mlData = await mlResponse.json();
    } catch {
      return jsonError("Respons prediksi AI tidak valid.", 502);
    }

    if (!isMLResponse(mlData)) {
      return jsonError("Format prediksi AI tidak valid.", 502);
    }

    // 8. Apply operational safety override
    const finalStatus: StockStatus =
      currentStock <= minimumStock
        ? "Restock"
        : mlData.stock_status;

    // 9. Generate RAG recommendation
    let ragResponse: Response;

    try {
      ragResponse = await fetch(
        `${ML_API_URL}/rag/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_name: item.name,
            current_stock: currentStock,
            minimum_stock: minimumStock,
            unit: item.unit,
            stock_status: finalStatus,
            data_quality: dataQuality,
            lead_time_days: body.lead_time_days,
          }),
          signal: AbortSignal.timeout(90000),
          cache: "no-store",
        }
      );
    } catch {
      return jsonError("Layanan RAG tidak tersedia.", 503);
    }

    if (!ragResponse.ok) {
      console.error(
        "RAG API returned status:",
        ragResponse.status
      );

      return jsonError(
        "Layanan RAG gagal menghasilkan rekomendasi.",
        502
      );
    }

    let ragData: unknown;

    try {
      ragData = await ragResponse.json();
    } catch {
      return jsonError("Respons RAG tidak valid.", 502);
    }

    if (!isRAGResponse(ragData)) {
      return jsonError(
        "Format hasil rekomendasi RAG tidak valid.",
        502
      );
    }

    // 10. Return result
    return NextResponse.json(
      {
        success: true,
        data: {
          item: {
            id: item.id,
            name: item.name,
            category: item.category,
            unit: item.unit,
          },
          inventory: {
            current_stock: currentStock,
            minimum_stock: minimumStock,
          },
          prediction: {
            stock_status: finalStatus,
            confidence: mlData.confidence,
          },
          data_quality: dataQuality,
          lead_time_days: body.lead_time_days,
          summary: ragData.summary,
          generated_at: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error("RAG Next.js API error:", error);

    return jsonError(
      "Terjadi kesalahan saat menghasilkan rekomendasi AI.",
      500
    );
  }
}
