
import { NextRequest, NextResponse } from "next/server";

import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WINDOW_DAYS = 30;
const MIN_USAGE_TRANSACTIONS = 5;
const MIN_USAGE_DAYS = 3;

const MAX_BODY_BYTES = 4096;
const MAX_TRANSACTIONS = 10000;
const PAGE_SIZE = 500;

const ML_API_URL =
  process.env.ML_API_URL ??
  "http://127.0.0.1:8000";

type StockStatus =
  | "Restock"
  | "Sufficient"
  | "Excess";

type DataQualityLevel =
  | "insufficient"
  | "limited"
  | "adequate";

type PredictRequest = {
  item_id: string;
  lead_time_days: number;
};

type MlPrediction = {
  stock_status: StockStatus;
  confidence: number;
  probabilities: Record<string, number>;
  model_type: string;
  dataset_type: string;
};

type TransactionRow = {
  transaction_type: string;
  quantity: number;
  created_at: string;
};

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: responseHeaders,
    }
  );
}

function verifyOrigin(request: NextRequest) {
  const configuredOrigin =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "");

  if (!configuredOrigin) {
    return jsonError(
      "APP_ORIGIN belum dikonfigurasi.",
      500
    );
  }

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

  if (
    request.headers.get("origin") !== allowedOrigin
  ) {
    return jsonError(
      "Origin request tidak diizinkan.",
      403
    );
  }

  return null;
}

function isValidRequest(
  value: unknown
): value is PredictRequest {
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

function isValidNumber(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0
  );
}

function isMlPrediction(
  value: unknown
): value is MlPrediction {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return false;
  }

  const data = value as Record<string, unknown>;

  const validStatuses = [
    "Restock",
    "Sufficient",
    "Excess",
  ];

  if (
    !validStatuses.includes(
      String(data.stock_status)
    ) ||
    typeof data.confidence !== "number" ||
    !Number.isFinite(data.confidence) ||
    data.confidence < 0 ||
    data.confidence > 1 ||
    typeof data.model_type !== "string" ||
    typeof data.dataset_type !== "string" ||
    typeof data.probabilities !== "object" ||
    data.probabilities === null ||
    Array.isArray(data.probabilities)
  ) {
    return false;
  }

  const probabilities =
    data.probabilities as Record<string, unknown>;

  return validStatuses.every(
    (status) =>
      typeof probabilities[status] === "number" &&
      Number.isFinite(probabilities[status]) &&
      probabilities[status] >= 0 &&
      probabilities[status] <= 1
  );
}

async function getRecentTransactions(
  itemId: string,
  startDate: string,
  endDate: string
): Promise<TransactionRow[]> {
  const transactions: TransactionRow[] = [];

  for (
    let offset = 0;
    offset < MAX_TRANSACTIONS;
    offset += PAGE_SIZE
  ) {
    const { data, error } = await supabaseAdmin
      .from("stock_transactions")
      .select(
        "transaction_type, quantity, created_at"
      )
      .eq("item_id", itemId)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .in("transaction_type", [
        "usage",
        "waste",
      ])
      .order("created_at", {
        ascending: true,
      })
      .range(
        offset,
        offset + PAGE_SIZE - 1
      );

    if (error) {
      throw new Error(
        "Gagal mengambil riwayat transaksi."
      );
    }

    const rows = data ?? [];

    for (const row of rows) {
      const quantity = Number(
        row.quantity
      );

      const createdAt = new Date(
        row.created_at
      );

      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(
          createdAt.getTime()
        ) ||
        !["usage", "waste"].includes(
          row.transaction_type
        )
      ) {
        throw new Error(
          "Data transaksi inventory tidak valid."
        );
      }

      transactions.push({
        transaction_type:
          row.transaction_type,
        quantity,
        created_at:
          createdAt.toISOString(),
      });
    }

    if (rows.length < PAGE_SIZE) {
      return transactions;
    }
  }

  throw new Error(
    "Riwayat transaksi terlalu banyak untuk diproses."
  );
}

function calculateDataQuality(
  transactions: TransactionRow[]
) {
  let totalUsage = 0;
  let totalWaste = 0;

  let usageCount = 0;
  let wasteCount = 0;

  const usageDays = new Set<string>();

  for (const transaction of transactions) {
    if (
      transaction.transaction_type === "usage"
    ) {
      totalUsage += transaction.quantity;
      usageCount++;

      // Menggunakan tanggal UTC secara konsisten.
      const usageDate =
        transaction.created_at.slice(0, 10);

      usageDays.add(usageDate);
    }

    if (
      transaction.transaction_type === "waste"
    ) {
      totalWaste += transaction.quantity;
      wasteCount++;
    }
  }

  const averageDailyUsage =
    totalUsage / WINDOW_DAYS;

  const averageDailyWaste =
    totalWaste / WINDOW_DAYS;

  const distinctUsageDays =
    usageDays.size;

  const hasRecentUsage =
    usageCount > 0;

  const hasRecentWaste =
    wasteCount > 0;

  let level: DataQualityLevel;
  let warning: string | null = null;

  if (usageCount === 0) {
    level = "insufficient";

    warning =
      "Belum ada riwayat penggunaan dalam 30 hari terakhir. Prediksi belum cukup didukung data pemakaian.";
  } else if (
    usageCount < MIN_USAGE_TRANSACTIONS ||
    distinctUsageDays < MIN_USAGE_DAYS
  ) {
    level = "limited";

    warning =
      "Riwayat penggunaan masih terbatas. Gunakan prediksi sebagai referensi awal, bukan keputusan restock otomatis.";
  } else {
    level = "adequate";
  }

  return {
    averageDailyUsage,
    averageDailyWaste,
    dataQuality: {
      level,
      window_days: WINDOW_DAYS,
      usage_transactions: usageCount,
      waste_transactions: wasteCount,
      total_consumption_transactions:
        usageCount + wasteCount,
      distinct_usage_days:
        distinctUsageDays,
      minimum_usage_transactions:
        MIN_USAGE_TRANSACTIONS,
      minimum_usage_days:
        MIN_USAGE_DAYS,
      has_recent_usage:
        hasRecentUsage,
      has_recent_waste:
        hasRecentWaste,
      limited_history_warning:
        warning,
    },
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    // 1. Authentication and authorization.
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return jsonError(
        auth.message,
        auth.status
      );
    }

    // 2. Validate request origin.
    const originError =
      verifyOrigin(request);

    if (originError) {
      return originError;
    }

    // 3. Validate Content-Type.
    const contentType =
      request.headers.get(
        "content-type"
      ) ?? "";

    if (
      !/^application\/json(?:\s*;|$)/i.test(
        contentType
      )
    ) {
      return jsonError(
        "Content-Type harus application/json.",
        415
      );
    }

    // 4. Validate request body.
    const declaredLength = Number(
      request.headers.get(
        "content-length"
      )
    );

    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_BODY_BYTES
    ) {
      return jsonError(
        "Ukuran request terlalu besar.",
        413
      );
    }

    const rawBody =
      await request.text();

    if (
      new TextEncoder()
        .encode(rawBody)
        .byteLength > MAX_BODY_BYTES
    ) {
      return jsonError(
        "Ukuran request terlalu besar.",
        413
      );
    }

    let body: unknown;

    try {
      body = JSON.parse(rawBody);
    } catch {
      return jsonError(
        "Format JSON tidak valid.",
        400
      );
    }

    if (!isValidRequest(body)) {
      return jsonError(
        "item_id atau lead_time_days tidak valid.",
        400
      );
    }

    // 5. Fetch actual inventory data.
    const {
      data: item,
      error: itemError,
    } = await supabaseAdmin
      .from(
        "inventory_current_stock"
      )
      .select(
        "id, name, category, unit, current_stock, minimum_stock"
      )
      .eq("id", body.item_id)
      .is("archived_at", null)
      .maybeSingle();

    if (itemError) {
      throw new Error(
        "Gagal mengambil data inventory."
      );
    }

    if (!item) {
      return jsonError(
        "Item aktif tidak ditemukan.",
        404
      );
    }

    const currentStock = Number(
      item.current_stock
    );

    const minimumStock = Number(
      item.minimum_stock
    );

    if (
      !isValidNumber(
        currentStock
      ) ||
      !isValidNumber(
        minimumStock
      )
    ) {
      return jsonError(
        "Data stok tidak valid untuk prediksi.",
        422
      );
    }

    // 6. Fetch transaction history.
    const now = new Date();

    const start = new Date(
      now.getTime() -
        WINDOW_DAYS *
          24 *
          60 *
          60 *
          1000
    );

    const transactions =
      await getRecentTransactions(
        body.item_id,
        start.toISOString(),
        now.toISOString()
      );

    const {
      averageDailyUsage,
      averageDailyWaste,
      dataQuality,
    } = calculateDataQuality(
      transactions
    );

    // 7. Build ML features.
    const mlPayload = {
      current_stock:
        currentStock,
      minimum_stock:
        minimumStock,
      average_daily_usage:
        averageDailyUsage,
      average_daily_waste:
        averageDailyWaste,
      lead_time_days:
        body.lead_time_days,
    };

    // 8. Request FastAPI prediction.
    let mlResponse: Response;

    try {
      mlResponse = await fetch(
        `${ML_API_URL}/predict`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            mlPayload
          ),
          signal:
            AbortSignal.timeout(
              5000
            ),
          cache: "no-store",
        }
      );
    } catch {
      return jsonError(
        "Layanan prediksi AI tidak tersedia.",
        503
      );
    }

    if (!mlResponse.ok) {
      console.error(
        "ML API returned status:",
        mlResponse.status
      );

      return jsonError(
        "Layanan AI gagal memproses prediksi.",
        502
      );
    }

    let mlData: unknown;

    try {
      mlData =
        await mlResponse.json();
    } catch {
      return jsonError(
        "Respons layanan AI tidak valid.",
        502
      );
    }

    if (!isMlPrediction(mlData)) {
      return jsonError(
        "Format hasil prediksi AI tidak valid.",
        502
      );
    }

    // 9. Operational safety override.
    const belowMinimum =
      currentStock <= minimumStock;

    const finalStatus: StockStatus =
      belowMinimum
        ? "Restock"
        : mlData.stock_status;

    const safetyOverride =
      belowMinimum &&
      mlData.stock_status !==
        "Restock";

    // 10. Return prediction and data quality.
    return NextResponse.json(
      {
        success: true,
        data: {
          item: {
            id: item.id,
            name: item.name,
            category:
              item.category,
            unit: item.unit,
          },

          features:
            mlPayload,

          prediction: {
            stock_status:
              finalStatus,
            model_stock_status:
              mlData.stock_status,
            confidence:
              mlData.confidence,
            probabilities:
              mlData.probabilities,
            model_type:
              mlData.model_type,
            dataset_type:
              mlData.dataset_type,
            safety_override:
              safetyOverride,
          },

          data_quality:
            dataQuality,

          calculated_at:
            now.toISOString(),
        },
      },
      {
        status: 200,
        headers:
          responseHeaders,
      }
    );
  } catch (error) {
    console.error(
      "AI prediction API error:",
      error
    );

    return jsonError(
      "Terjadi kesalahan saat memproses prediksi AI.",
      500
    );
  }
}
