
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

const transactionTypes = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
] as const;

type TransactionType = (typeof transactionTypes)[number];

type DailyActivity = {
  date: string;
  stock_in: number;
  stock_out: number;
  usage: number;
  waste: number;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers }
  );
}

// Get calendar date in Jakarta.
function jakartaDate(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// Get date key in YYYY-MM-DD format.
function dateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function GET() {
  try {
    // Verify authenticated admin.
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse("Unauthorized.", 401);
    }

    const adminId = process.env.ADMIN_USER_ID;

    if (!adminId) {
      return errorResponse("Admin belum dikonfigurasi.", 500);
    }

    if (user.id !== adminId) {
      return errorResponse("Forbidden.", 403);
    }

    // Calculate the last seven Jakarta calendar days.
    const today = jakartaDate(new Date());
    const [year, month, day] = today.split("-").map(Number);

    const startUtc = new Date(
      Date.UTC(year, month - 1, day - 6, -7)
    );

    const startIso = startUtc.toISOString();

    // Fetch transactions in batches.
    const transactions: {
      id: string;
      transaction_type: string;
      created_at: string;
    }[] = [];

    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await supabaseAdmin
        .from("stock_transactions")
        .select("id, transaction_type, created_at")
        .gte("created_at", startIso)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) throw error;

      const rows = data ?? [];
      transactions.push(...rows);

      if (rows.length < batchSize) break;

      offset += batchSize;
    }

    // Initialize daily activity.
    const daily: DailyActivity[] = [];

    for (let index = 6; index >= 0; index--) {
      const date = new Date(
        Date.UTC(year, month - 1, day - index, 12)
      );

      daily.push({
        date: dateKey(date),
        stock_in: 0,
        stock_out: 0,
        usage: 0,
        waste: 0,
      });
    }

    const dailyMap = new Map(
      daily.map((entry) => [entry.date, entry])
    );

    const totals: Record<TransactionType, number> = {
      stock_in: 0,
      stock_out: 0,
      usage: 0,
      waste: 0,
    };

    // Count transactions by date and type.
    for (const transaction of transactions) {
      const type = transaction.transaction_type as TransactionType;

      if (!transactionTypes.includes(type)) continue;

      const date = dateKey(new Date(transaction.created_at));
      const entry = dailyMap.get(date);

      if (!entry) continue;

      entry[type] += 1;
      totals[type] += 1;
    }

    // Fetch inventory stock alerts.
    const { data: inventory, error: inventoryError } =
      await supabaseAdmin
        .from("inventory_current_stock")
        .select(
          "id, name, unit, current_stock, minimum_stock"
        );

    if (inventoryError) throw inventoryError;

    const lowStock = (inventory ?? [])
      .filter(
        (item) =>
          Number(item.current_stock) <=
          Number(item.minimum_stock)
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        current_stock: Number(item.current_stock),
        minimum_stock: Number(item.minimum_stock),
      }))
      .sort(
        (a, b) =>
          a.current_stock - a.minimum_stock -
          (b.current_stock - b.minimum_stock)
      );

    // Return analytics.
    return NextResponse.json(
      {
        success: true,
        data: {
          period: {
            days: 7,
            timezone: "Asia/Jakarta",
          },
          totals,
          daily,
          lowStock,
          lowStockCount: lowStock.length,
        },
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Inventory analytics error:", error);

    return errorResponse(
      "Gagal mengambil data analytics.",
      500
    );
  }
}
