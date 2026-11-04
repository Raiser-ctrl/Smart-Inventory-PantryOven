
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

const jakartaFormatter = new Intl.DateTimeFormat(
  "en-US",
  {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }
);

function jakartaDateKey(date: Date): string {
  const parts = jakartaFormatter.formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)
      ?.value ?? "";

  return (
    `${get("year")}-${get("month")}-${get("day")}`
  );
}

function jakartaMidnightUtc(dateKey: string): Date {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

  return new Date(
    Date.UTC(year, month - 1, day, -7)
  );
}

function addCalendarDays(
  dateKey: string,
  days: number
): string {
  const [year, month, day] = dateKey
    .split("-")
    .map(Number);

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
    transactionCount:
      current.transactionCount + 1,
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
          transactionCount:
            activity.transactionCount,
        },
      ];
    })
    .sort(
      (a, b) =>
        b.transactionCount -
          a.transactionCount ||
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

async function getItemInformation(
  itemIds: string[]
): Promise<Map<string, ItemInfo>> {
  const itemInfo = new Map<string, ItemInfo>();

  for (
    let offset = 0;
    offset < itemIds.length;
    offset += ITEM_BATCH_SIZE
  ) {
    const batchIds = itemIds.slice(
      offset,
      offset + ITEM_BATCH_SIZE
    );

    const { data, error } =
      await measureAnalyticsOperation(
        "Item Metadata Query",
        () =>
          supabaseAdmin
            .from("items")
            .select("id, name, unit, category")
            .in("id", batchIds)
      );

    if (error) {
      console.error(
        "Analytics item query error:",
        error
      );

      throw new Error(
        "Gagal mengambil metadata barang."
      );
    }

    for (const item of data ?? []) {
      itemInfo.set(item.id, {
        name: item.name,
        unit: item.unit,
        category: item.category,
      });
    }
  }

  return itemInfo;
}

async function resolveItemInformation(
  itemIds: string[],
  inventoryPromise?: Promise<InventoryItem[]>
): Promise<Map<string, ItemInfo>> {
  if (itemIds.length === 0) {
    // Observe any supplied promise rejection.
    await inventoryPromise?.catch(() => undefined);
    return new Map();
  }

  if (inventoryPromise) {
    try {
      const inventory = await inventoryPromise;
      const available = inventoryToItemInfo(
        inventory
      );

      const result = new Map<string, ItemInfo>();
      const missingIds: string[] = [];

      for (const id of itemIds) {
        const item = available.get(id);

        if (item) {
          result.set(id, item);
        } else {
          missingIds.push(id);
        }
      }

      if (missingIds.length === 0) {
        return result;
      }

      const missingInfo =
        await getItemInformation(missingIds);

      for (const [id, item] of missingInfo) {
        result.set(id, item);
      }

      return result;
    } catch (error) {
      if (shouldMeasurePerformance) {
        console.info(
          "[Analytics] Inventory reuse unavailable:",
          error
        );
      }
    }
  }

  return getItemInformation(itemIds);
}

export async function getInventoryAnalytics(
  period: AnalyticsPeriod = 7,
  options: AnalyticsOptions = {}
) {
  if (period !== 7 && period !== 30) {
    throw new Error(
      "Periode analytics tidak valid."
    );
  }

  const startedAt = performance.now();
  const snapshotTime = new Date();

  const today = jakartaDateKey(snapshotTime);

  const startDate = addCalendarDays(
    today,
    -(period - 1)
  );

  const nextDate = addCalendarDays(
    today,
    1
  );

  const startIso =
    jakartaMidnightUtc(startDate)
      .toISOString();

  const endIso =
    jakartaMidnightUtc(nextDate)
      .toISOString();

  // Prevent newly created transactions from
  // entering the current analytics request.
  const cutoffIso =
    snapshotTime.toISOString();

  const daily: DailyActivity[] = Array.from(
    { length: period },
    (_, index) => ({
      date: addCalendarDays(
        startDate,
        index
      ),
      stock_in: 0,
      stock_out: 0,
      usage: 0,
      waste: 0,
    })
  );

  const dailyMap = new Map(
    daily.map((entry) => [
      entry.date,
      entry,
    ])
  );

  // These values represent transaction counts,
  // not total stock quantities.
  const totals: Record<
    TransactionType,
    number
  > = {
    stock_in: 0,
    stock_out: 0,
    usage: 0,
    waste: 0,
  };

  const usageMap = new Map<
    string,
    ActivitySummary
  >();

  const wasteMap = new Map<
    string,
    ActivitySummary
  >();

  let cursorCreatedAt: string | null = null;
  let cursorId: string | null = null;

  let transactionCount = 0;

  try {
    while (true) {
      let query = supabaseAdmin
        .from("stock_transactions")
        .select(
          "id, item_id, transaction_type, quantity, created_at"
        )
        .gte("created_at", startIso)
        .lt("created_at", endIso)
        .lte("created_at", cutoffIso);

      // Keyset pagination in ascending order.
      if (cursorCreatedAt && cursorId) {
        query = query.or(
          `created_at.gt.${cursorCreatedAt},` +
          `and(created_at.eq.${cursorCreatedAt},id.gt.${cursorId})`
        );
      }

      const { data, error } =
        await measureAnalyticsOperation(
          "Transactions Query",
          () =>
            query
              .order("created_at", {
                ascending: true,
              })
              .order("id", {
                ascending: true,
              })
              .limit(BATCH_SIZE)
        );

      if (error) {
        console.error(
          "Inventory analytics query error:",
          error
        );

        throw new Error(
          "Gagal mengambil transaksi analytics."
        );
      }

      const rows: TransactionRow[] =
        data ?? [];

      for (const transaction of rows) {
        if (
          !isTransactionType(
            transaction.transaction_type
          )
        ) {
          continue;
        }

        const quantity = Number(
          transaction.quantity
        );

        if (
          !Number.isFinite(quantity) ||
          quantity < 0
        ) {
          throw new Error(
            "Ditemukan kuantitas transaksi tidak valid."
          );
        }

        const date = jakartaDateKey(
          new Date(transaction.created_at)
        );

        const entry = dailyMap.get(date);

        if (!entry) continue;

        const type =
          transaction.transaction_type;

        // Count transactions, not quantities.
        entry[type] += 1;
        totals[type] += 1;
        transactionCount += 1;

        if (type === "usage") {
          updateItemActivity(
            usageMap,
            transaction.item_id,
            quantity
          );
        }

        if (type === "waste") {
          updateItemActivity(
            wasteMap,
            transaction.item_id,
            quantity
          );
        }
      }

      if (rows.length < BATCH_SIZE) {
        break;
      }

      const last = rows[rows.length - 1];

      cursorCreatedAt = last.created_at;
      cursorId = last.id;
    }
  } catch (error) {
    // Avoid an unhandled rejection from an
    // inventory promise supplied by the caller.
    await options.inventoryPromise?.catch(
      () => undefined
    );
    throw error;
  }

  const relevantItemIds = [
    ...new Set([
      ...usageMap.keys(),
      ...wasteMap.keys(),
    ]),
  ];

  const itemInfo =
    await resolveItemInformation(
      relevantItemIds,
      options.inventoryPromise
    );

  const topUsedMaterials =
    buildItemActivity(
      usageMap,
      itemInfo
    ).filter(
      (item) =>
        item.category === "raw_material"
    );

  const wasteMonitoring =
    buildItemActivity(
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
