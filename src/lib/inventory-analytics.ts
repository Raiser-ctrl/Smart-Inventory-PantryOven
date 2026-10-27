
import "server-only";

import { performance } from "node:perf_hooks";
import { supabaseAdmin } from "@/lib/supabase-admin";

import type { InventoryItem } from "@/lib/inventory";

export type AnalyticsPeriod = 7 | 30;

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

type TransactionRow = {
  id: string;
  item_id: string;
  transaction_type: string;
  quantity: number;
  created_at: string;
};

type ItemInfo = {
  name: string;
  unit: string;
  category: string;
};

type ActivitySummary = {
  quantity: number;
  transactionCount: number;
};

export type ItemActivity = {
  item_id: string;
  name: string;
  unit: string;
  category: string;
  quantity: number;
  transactionCount: number;
};

type AnalyticsOptions = {
  inventoryPromise?: Promise<InventoryItem[]>;
};

const BATCH_SIZE = 1000;
const ITEM_BATCH_SIZE = 200;
const JAKARTA_OFFSET_HOURS = 7;

const shouldMeasurePerformance =
  process.env.NODE_ENV === "development" ||
  process.env.PERF_DEBUG === "true";

async function measureAnalyticsOperation<T>(
  label: string,
  operation: () => PromiseLike<T>
): Promise<T> {
  if (!shouldMeasurePerformance) {
    return await operation();
  }

  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    console.info(
      `[Analytics] ${label}: ${Math.round(
        performance.now() - startedAt
      )}ms`
    );
  }
}

const jakartaFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function jakartaDateKey(date: Date): string {
  const parts = jakartaFormatter.formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function jakartaMidnightUtc(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, -JAKARTA_OFFSET_HOURS)
  );
}

function addCalendarDays(
  dateKey: string,
  days: number
): string {
  const [year, month, day] = dateKey.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day + days, 12)
  )
    .toISOString()
    .slice(0, 10);
}

function isTransactionType(
  value: string
): value is TransactionType {
  return (
    value === "stock_in" ||
    value === "stock_out" ||
    value === "usage" ||
    value === "waste"
  );
}

function updateItemActivity(
  target: Map<string, ActivitySummary>,
  itemId: string,
  quantity: number
) {
  const current = target.get(itemId) ?? {
    quantity: 0,
    transactionCount: 0,
  };

  target.set(itemId, {
    quantity: current.quantity + quantity,
    transactionCount: current.transactionCount + 1,
  });
}

function buildItemActivity(
  source: Map<string, ActivitySummary>,
  itemInfo: Map<string, ItemInfo>
): ItemActivity[] {
  return [...source.entries()]
    .flatMap(([itemId, activity]) => {
      const item = itemInfo.get(itemId);

      if (!item) return [];

      return [
        {
          item_id: itemId,
          name: item.name,
          unit: item.unit,
          category: item.category,
          quantity: activity.quantity,
          transactionCount: activity.transactionCount,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.transactionCount - a.transactionCount ||
        a.name.localeCompare(b.name, "id")
    );
}

function inventoryToItemInfo(
  items: InventoryItem[]
): Map<string, ItemInfo> {
  return new Map(
    items.map((item) => [
      item.id,
      {
        name: item.name,
        unit: item.unit,
        category: item.category,
      },
    ])
  );
}

async function getItemInformation() {
  const itemInfo = new Map<string, ItemInfo>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("items")
      .select("id, name, unit, category")
      .order("id", { ascending: true })
      .range(offset, offset + ITEM_BATCH_SIZE - 1);

    if (error) {
      console.error("Analytics item query error:", error);

      throw new Error(
        "Gagal mengambil informasi barang analytics."
      );
    }

    const rows = data ?? [];

    for (const item of rows) {
      itemInfo.set(item.id, {
        name: item.name,
        unit: item.unit,
        category: item.category,
      });
    }

    if (rows.length < ITEM_BATCH_SIZE) {
      break;
    }

    offset += ITEM_BATCH_SIZE;
  }

  return itemInfo;
}

async function resolveItemInformation(
  inventoryPromise?: Promise<InventoryItem[]>
) {
  if (!inventoryPromise) {
    return measureAnalyticsOperation(
      "Item Metadata Query",
      () => getItemInformation()
    );
  }

  try {
    const items = await inventoryPromise;

    if (shouldMeasurePerformance) {
      console.info(
        `[Analytics] Reused inventory metadata: ${items.length} items`
      );
    }

    return inventoryToItemInfo(items);
  } catch {
    if (shouldMeasurePerformance) {
      console.info(
        "[Analytics] Inventory unavailable, fetching item metadata"
      );
    }

    return measureAnalyticsOperation(
      "Item Metadata Fallback Query",
      () => getItemInformation()
    );
  }
}

// Get analytics for 7 or 30 Jakarta calendar days.
export async function getInventoryAnalytics(
  period: AnalyticsPeriod = 7,
  options: AnalyticsOptions = {}
) {
  if (period !== 7 && period !== 30) {
    throw new Error("Periode analytics tidak valid.");
  }

  const startedAt = performance.now();
  const today = jakartaDateKey(new Date());

  const startDate = addCalendarDays(today, -(period - 1));
  const nextDate = addCalendarDays(today, 1);

  const startIso = jakartaMidnightUtc(
    startDate
  ).toISOString();

  const endIso = jakartaMidnightUtc(
    nextDate
  ).toISOString();

  const daily: DailyActivity[] = Array.from(
    { length: period },
    (_, index) => ({
      date: addCalendarDays(startDate, index),
      stock_in: 0,
      stock_out: 0,
      usage: 0,
      waste: 0,
    })
  );

  const dailyMap = new Map(
    daily.map((entry) => [entry.date, entry])
  );

  const totals: Record<TransactionType, number> = {
    stock_in: 0,
    stock_out: 0,
    usage: 0,
    waste: 0,
  };

  const usageMap = new Map<string, ActivitySummary>();
  const wasteMap = new Map<string, ActivitySummary>();

  // Metadata and transactions are processed concurrently.
  const itemInfoPromise = resolveItemInformation(
    options.inventoryPromise
  );

  let offset = 0;
  let transactionCount = 0;

  try {
    while (true) {
      const { data, error } =
        await measureAnalyticsOperation(
          "Transactions Query",
          () =>
            supabaseAdmin
              .from("stock_transactions")
              .select(
                "id, item_id, transaction_type, quantity, created_at"
              )
              .gte("created_at", startIso)
              .lt("created_at", endIso)
              .order("created_at", { ascending: true })
              .order("id", { ascending: true })
              .range(
                offset,
                offset + BATCH_SIZE - 1
              )
        );

      if (error) {
        console.error(
          "Inventory analytics query error:",
          error
        );

        throw new Error(
          "Gagal mengambil data transaksi analytics."
        );
      }

      const rows: TransactionRow[] = data ?? [];

      for (const transaction of rows) {
        if (!isTransactionType(transaction.transaction_type)) {
          continue;
        }

        const date = jakartaDateKey(
          new Date(transaction.created_at)
        );

        const entry = dailyMap.get(date);

        if (!entry) continue;

        const type = transaction.transaction_type;

        entry[type] += 1;
        totals[type] += 1;
        transactionCount += 1;

        if (type === "usage" || type === "waste") {
          const quantity = Number(transaction.quantity);

          if (!Number.isFinite(quantity) || quantity < 0) {
            throw new Error(
              "Ditemukan kuantitas transaksi tidak valid."
            );
          }

          updateItemActivity(
            type === "usage" ? usageMap : wasteMap,
            transaction.item_id,
            quantity
          );
        }
      }

      if (rows.length < BATCH_SIZE) break;

      offset += BATCH_SIZE;
    }
  } finally {
    // Observe metadata errors even if transaction processing fails.
    await itemInfoPromise.catch(() => undefined);
  }

  const itemInfo = await itemInfoPromise;

  const topUsedMaterials = buildItemActivity(
    usageMap,
    itemInfo
  ).filter(
    (item) => item.category === "raw_material"
  );

  const wasteMonitoring = buildItemActivity(
    wasteMap,
    itemInfo
  );

  if (shouldMeasurePerformance) {
    console.info(
      `[Analytics] ${period} days | ` +
        `${transactionCount} transactions | ` +
        `${Math.round(
          performance.now() - startedAt
        )}ms`
    );
  }

  return {
    period,
    timezone: "Asia/Jakarta",
    startDate,
    endDate: today,
    totals,
    daily,
    topUsedMaterials,
    wasteMonitoring,
  };
}
