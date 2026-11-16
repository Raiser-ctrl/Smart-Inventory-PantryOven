import Link from "next/link";
import { performance } from "node:perf_hooks";

import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Package,
} from "lucide-react";

import { requireApprovedUser } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory";

import {
  getInventoryAnalytics,
  type AnalyticsPeriod,
} from "@/lib/inventory-analytics";

import InventoryAnalytics from "@/components/dashboard/InventoryAnalytics";
import DashboardInventoryOverview from "@/components/dashboard/InventoryOverview";
import BakeryMorningArt from "@/components/dashboard/BakeryMorningArt";

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

const numberFormatter = new Intl.NumberFormat("id-ID");

export default async function DashboardPage({
  searchParams,
}: DashboardProps) {
  await measured("Auth", () => requireApprovedUser());

  const params = await searchParams;

  const requestedPeriod = Array.isArray(params.period)
    ? params.period[0]
    : params.period;

  const period: AnalyticsPeriod =
    requestedPeriod === "30" ? 30 : 7;

  // Existing data-fetching behavior is preserved.
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

  const overviewItems = activeItems.map((item) => ({
    ...item,
    current_stock: Number(item.current_stock),
    minimum_stock: Number(item.minimum_stock),
  }));

  const stockFormatter = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 6,
  });
  const stockPreview = lowStockItems.slice(0, 2);
  const remainingLowStock = lowStockItems.length - stockPreview.length;

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-5 lg:space-y-6">
      {/* Dashboard heading */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Dashboard
        </h1>

        <nav
          aria-label="Analytics period"
          className="inline-flex shrink-0 gap-1 rounded-2xl border border-white/35 bg-white/35 p-1 backdrop-blur-xl"
        >
          {([7, 30] as const).map((days) => (
            <Link
              key={days}
              href={`/dashboard?period=${days}`}
              prefetch={false}
              aria-current={
                period === days ? "page" : undefined
              }
              className={[
                "inline-flex min-h-10 items-center",
                "rounded-xl px-4 text-xs font-semibold",
                "transition-colors",
                "focus-visible:outline-2",
                "focus-visible:outline-offset-2",
                period === days
                  ? "bg-[#536d50] text-white"
                  : "text-muted-foreground hover:bg-white/40 hover:text-foreground",
              ].join(" ")}
            >
              {days} Days
            </Link>
          ))}
        </nav>
      </header>

      {/* Compact welcome banner */}
      <section
        aria-labelledby="bakery-welcome"
        className={[
          "po-bakery-accent relative isolate",
          "overflow-hidden rounded-[24px]",
          "border border-[#c99165]/15",
        ].join(" ")}
      >
        <div className="grid min-w-0 items-center gap-3 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_190px] lg:grid-cols-[minmax(0,1fr)_230px]">
          <div className="relative z-10 min-w-0 space-y-3">
            <div className="space-y-2">
              <h2
                id="bakery-welcome"
                className="max-w-xl text-xl font-bold leading-tight tracking-tight text-[#343b32] sm:text-2xl"
              >
                A little more organized,
                <span className="block text-[#637c5e]">
                  a lot more delightful.
                </span>
              </h2>

              <p className="max-w-lg text-sm leading-relaxed text-[#5d6358]">
                Kelola bahan baku dan pantau stok
                bakery dengan lebih mudah.
              </p>
            </div>

            <Link
              href="/inventory"
              className={[
                "inline-flex min-h-10 items-center",
                "gap-2 rounded-xl",
                "bg-[#536d50] px-4 py-2",
                "text-sm font-semibold text-white",
                "transition-colors hover:bg-[#435a40]",
                "focus-visible:outline-2",
                "focus-visible:outline-offset-2",
              ].join(" ")}
            >
              Explore Inventory
              <ArrowRight
                aria-hidden="true"
                className="size-4"
              />
            </Link>
          </div>

          <div className="hidden md:block">
            <BakeryMorningArt />
          </div>
        </div>
      </section>

      {/* Inventory statistics */}
      {inventoryError ? (
        <div
          role="alert"
          className="po-panel rounded-[22px] border border-destructive/30 p-5 text-sm text-destructive"
        >
          Data inventory belum dapat dimuat.
        </div>
      ) : (
        <section
          aria-label="Ringkasan inventory"
          className="grid min-w-0 gap-3 sm:grid-cols-2"
        >
          <Link
            href={lowStockItems.length ? "/inventory?stock=low" : "/inventory?status=active"}
            className={`flex min-w-0 flex-col gap-2 rounded-[22px] border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-5 ${
              lowStockItems.length
                ? "border-amber-200 bg-amber-50/80 hover:bg-amber-50"
                : "border-white/60 bg-white/55 hover:bg-white/85"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#343B32]">
              <AlertTriangle aria-hidden="true" className={`size-4 shrink-0 ${lowStockItems.length ? "text-amber-800" : "text-[#536D50]"}`} />
              <h2>Low Stock</h2>
              <ArrowUpRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-[#536D50]" />
            </div>

            <p className="text-2xl font-bold tabular-nums text-[#343B32]">
              {numberFormatter.format(lowStockItems.length)} <span className="text-sm font-medium">item</span>
            </p>

            {stockPreview.length > 0 ? (
              <ul className="space-y-1 text-sm text-[#5F705B]">
                {stockPreview.map((item) => (
                  <li key={item.id} className="flex min-w-0 justify-between gap-2">
                    <span className="break-words [overflow-wrap:anywhere]">{item.name}</span>
                    <span className="shrink-0 tabular-nums">{stockFormatter.format(item.current_stock)} {item.unit}</span>
                  </li>
                ))}
                {remainingLowStock > 0 && (
                  <li>+{numberFormatter.format(remainingLowStock)} item lainnya</li>
                )}
              </ul>
            ) : (
              <p className="text-sm text-[#5F705B]">
                {activeItems.length ? "Semua stok di atas batas minimum." : "Belum ada item aktif."}
              </p>
            )}
          </Link>

          <Link
            href="/inventory?status=active"
            className="flex min-w-0 flex-col gap-2 rounded-[22px] border border-white/60 bg-white/55 p-4 transition-colors hover:bg-white/85 focus-visible:outline-2 focus-visible:outline-offset-2 sm:p-5"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-[#343B32]">
              <Package aria-hidden="true" className="size-4 shrink-0 text-[#536D50]" />
              <h2>Active Items</h2>
              <ArrowUpRight aria-hidden="true" className="ml-auto size-4 shrink-0 text-[#536D50]" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-[#343B32]">
              {numberFormatter.format(activeItems.length)} <span className="text-sm font-medium">item</span>
            </p>
            <p className="text-sm text-[#5F705B]">
              {numberFormatter.format(rawMaterials)} bahan baku · {numberFormatter.format(finishedProducts)} produk jadi
            </p>
          </Link>
        </section>
      )}

      {/* Operations overview */}
      <section
        aria-labelledby="operations-heading"
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined
              aria-hidden="true"
              className="size-5 text-[#536d50]"
            />

            <h2
              id="operations-heading"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Operations Overview
            </h2>
          </div>

          <Link
            href="/transactions"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-[#536d50] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            View History
            <ArrowUpRight
              aria-hidden="true"
              className="size-4"
            />
          </Link>
        </div>

        {analyticsError && (
          <div
            role="alert"
            className="po-panel rounded-[22px] border border-destructive/30 p-4 text-sm text-destructive"
          >
            Data analytics belum dapat dimuat.
          </div>
        )}

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
          {analytics && (
            <div className="min-w-0">
              <InventoryAnalytics
                period={period}
                data={{
                  totals: analytics.totals,
                  daily: analytics.daily,
                  lowStock: lowStockItems,
                  lowStockCount: lowStockItems.length,
                }}
              />
            </div>
          )}

          {!inventoryError && (
            <div className="min-w-0">
              <DashboardInventoryOverview items={overviewItems} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
