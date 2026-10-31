
import Link from "next/link";
import { performance } from "node:perf_hooks";
import { ArrowUpRight } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory";

import {
  getInventoryAnalytics,
  type AnalyticsPeriod,
} from "@/lib/inventory-analytics";

import InventoryAnalytics from "@/components/dashboard/InventoryAnalytics";
import InventoryOverview from "@/components/dashboard/InventoryOverview";

export const dynamic = "force-dynamic";

type DashboardProps = {
  searchParams: Promise<{
    period?: string | string[];
  }>;
};

const measure =
  process.env.NODE_ENV === "development" ||
  process.env.PERF_DEBUG === "true";

async function measured<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!measure) return fn();

  const start = performance.now();

  try {
    return await fn();
  } finally {
    console.info(
      `[Dashboard] ${label}: ${Math.round(
        performance.now() - start
      )}ms`
    );
  }
}

export default async function DashboardPage({
  searchParams,
}: DashboardProps) {
  await measured("Auth", () => requireAdmin());

  const params = await searchParams;

  const requestedPeriod = Array.isArray(params.period)
    ? params.period[0]
    : params.period;

  const period: AnalyticsPeriod =
    requestedPeriod === "30" ? 30 : 7;

  const inventoryPromise = measured(
    "Inventory Query",
    () => getInventoryItems()
  );

  const analyticsPromise = measured(
    "Analytics Query",
    () =>
      getInventoryAnalytics(period, {
        inventoryPromise,
      })
  );

  const [inventoryResult, analyticsResult] =
    await Promise.allSettled([
      inventoryPromise,
      analyticsPromise,
    ]);

  if (inventoryResult.status === "rejected") {
    console.error(
      "Dashboard inventory error:",
      inventoryResult.reason
    );
  }

  if (analyticsResult.status === "rejected") {
    console.error(
      "Dashboard analytics error:",
      analyticsResult.reason
    );
  }

  const inventoryError =
    inventoryResult.status === "rejected";

  const analyticsError =
    analyticsResult.status === "rejected";

  const items =
    inventoryResult.status === "fulfilled"
      ? inventoryResult.value
      : [];

  const analytics =
    analyticsResult.status === "fulfilled"
      ? analyticsResult.value
      : null;

  // Archived items are excluded from active stock.
  const activeItems = items.filter(
    (item) => !item.archived_at
  );

  const lowStockItems = activeItems
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
    }));

  const rawMaterials = activeItems.filter(
    (item) => item.category === "raw_material"
  ).length;

  const finishedProducts = activeItems.filter(
    (item) => item.category === "finished_product"
  ).length;

  const summary = [
    {
      label: "Active items",
      value: activeItems.length,
    },
    {
      label: "Raw materials",
      value: rawMaterials,
    },
    {
      label: "Finished products",
      value: finishedProducts,
    },
    {
      label: "Need attention",
      value: lowStockItems.length,
    },
  ];

  const overviewItems = activeItems.map(
    (item) => ({
      id: item.id,
      name: item.name,
      unit: item.unit,
      current_stock: Number(item.current_stock),
      minimum_stock: Number(item.minimum_stock),
    })
  );

  return (
    <main className="min-w-0 bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-5 lg:space-y-7">
        {/* Compact dashboard header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Dashboard
          </h1>

          <nav
            aria-label="Analytics period"
            className="inline-flex shrink-0 rounded-lg border p-1"
          >
            {([7, 30] as const).map((days) => (
              <Link
                key={days}
                href={`/dashboard?period=${days}`}
                prefetch={false}
                aria-current={
                  period === days
                    ? "page"
                    : undefined
                }
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                  period === days
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {days} days
              </Link>
            ))}
          </nav>
        </header>

        {/* Inventory statistics */}
        {inventoryError ? (
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive"
          >
            Data inventory belum dapat dimuat.
          </div>
        ) : (
          <section
            aria-label="Inventory statistics"
            className="overflow-hidden rounded-xl border bg-card"
          >
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {summary.map((item, index) => (
                <div
                  key={item.label}
                  className={`min-w-0 px-3 py-3.5 sm:p-5 ${
                    index < 2
                      ? "border-b sm:border-b-0"
                      : ""
                  } ${
                    index % 2 === 1
                      ? "border-l sm:border-l-0"
                      : ""
                  } ${
                    index > 0
                      ? "sm:border-l"
                      : ""
                  }`}
                >
                  <p className="text-xs leading-snug text-muted-foreground sm:text-sm">
                    {item.label}
                  </p>

                  <p
                    className={`mt-1.5 text-2xl font-semibold tabular-nums sm:mt-2 sm:text-3xl ${
                      item.label === "Need attention" &&
                      item.value > 0
                        ? "text-amber-700 dark:text-amber-400"
                        : ""
                    }`}
                  >
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Analytics and inventory */}
        <section
          aria-label="Operations overview"
          className="space-y-3 lg:space-y-4"
        >
          <div className="flex items-center justify-end">
            <Link
              href="/transactions"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              View history
              <ArrowUpRight className="size-4" />
            </Link>
          </div>

          {analyticsError && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/40 p-4 text-sm text-destructive"
            >
              Data analytics belum dapat dimuat.
            </div>
          )}

          <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
            {analytics && (
              <div className="min-w-0">
                <InventoryAnalytics
                  period={period}
                  data={{
                    totals: analytics.totals,
                    daily: analytics.daily,
                    lowStock: lowStockItems,
                    lowStockCount:
                      lowStockItems.length,
                  }}
                />
              </div>
            )}

            {!inventoryError && (
              <div className="min-w-0">
                <InventoryOverview
                  items={overviewItems}
                  topUsedMaterials={
                    analytics?.topUsedMaterials ?? []
                  }
                  wasteMonitoring={
                    analytics?.wasteMonitoring ?? []
                  }
                  period={period}
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
