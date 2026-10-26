
import "server-only";

import { supabaseAdmin } from "@/lib/supabase-admin";

type TransactionType =
  | "stock_in"
  | "stock_out"
  | "usage"
  | "waste";

type DailyActivity = {
  date: string;
  stock_in: number;
  stock_out: number;
  usage: number;
  waste: number;
};

const transactionTypes: TransactionType[] = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
];

// Get a date key in Jakarta time.
function jakartaDateKey(date: Date) {
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

// Get inventory analytics for the last seven days.
export async function getInventoryAnalytics() {
  const today = jakartaDateKey(new Date());

  const [year, month, day] = today
    .split("-")
    .map(Number);

  // Calculate the first day at midnight Jakarta time.
  const startIso = new Date(
    Date.UTC(year, month - 1, day - 6, -7)
  ).toISOString();

  const daily: DailyActivity[] = [];

  // Initialize seven calendar days.
  for (let index = 6; index >= 0; index--) {
    const date = new Date(
      Date.UTC(year, month - 1, day - index, 12)
    );

    daily.push({
      date: jakartaDateKey(date),
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

  // Fetch transactions in batches.
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

    if (error) {
      throw new Error(
        `Gagal mengambil transaksi: ${error.message}`
      );
    }

    const rows = data ?? [];

    // Count transactions by day and type.
    for (const transaction of rows) {
      const type =
        transaction.transaction_type as TransactionType;

      if (!transactionTypes.includes(type)) continue;

      const date = jakartaDateKey(
        new Date(transaction.created_at)
      );

      const entry = dailyMap.get(date);

      if (!entry) continue;

      entry[type] += 1;
      totals[type] += 1;
    }

    if (rows.length < batchSize) break;

    offset += batchSize;
  }

  return {
    totals,
    daily,
  };
}
