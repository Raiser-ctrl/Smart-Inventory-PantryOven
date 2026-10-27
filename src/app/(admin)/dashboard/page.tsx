
import Link from "next/link";
import { performance } from "node:perf_hooks";

import { requireAdmin } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory";

import {
  getInventoryAnalytics,
  type AnalyticsPeriod,
} from "@/lib/inventory-analytics";

import InventoryAnalytics from "@/components/dashboard/InventoryAnalytics";
import InventoryInsights from "@/components/dashboard/InventoryInsights";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Package,
  Wheat,
  CakeSlice,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

export const dynamic = "force-dynamic";

type DashboardProps = {
  searchParams: Promise<{
    period?: string | string[];
  }>;
};

// Enable performance logging in development or when PERF_DEBUG=true.
const shouldMeasurePerformance =
  process.env.NODE_ENV === "development" ||
  process.env.PERF_DEBUG === "true";

// Measure an asynchronous server operation.
async function measureOperation<T>(
  label: string,
  operation: () => Promise<T>
): Promise<T> {
  if (!shouldMeasurePerformance) {
    return operation();
  }

  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    console.info(
      `[Dashboard] ${label}: ${Math.round(
        performance.now() - startedAt
      )}ms`
    );
  }
}

export default async function DashboardPage({
  searchParams,
}: DashboardProps) {
  const pageStartedAt = performance.now();

  // Verify admin access before accessing inventory data.
  await measureOperation("Auth", () => requireAdmin());

  // Read and validate the selected analytics period.
  const params = await searchParams;

  const period: AnalyticsPeriod =
    params.period === "30" ? 30 : 7;

  // Fetch inventory and analytics concurrently.
  const inventoryPromise = measureOperation(
    "Inventory Query",
    () => getInventoryItems()
  );

  // Start analytics immediately; reuse inventory metadata.
  const analyticsPromise = measureOperation(
    "Analytics Query",
    () =>
      getInventoryAnalytics(period, {
        inventoryPromise,
      })
  );

  // Preserve independent error handling.
  const [inventoryResult, analyticsResult] =
    await Promise.allSettled([
      inventoryPromise,
      analyticsPromise,
    ]);

  // Handle inventory errors independently.
  const inventoryError =
    inventoryResult.status === "rejected"
      ? "Data inventory belum dapat dimuat."
      : "";

  const analyticsError =
    analyticsResult.status === "rejected"
      ? "Data analytics belum dapat dimuat."
      : "";

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

  const items =
    inventoryResult.status === "fulfilled"
      ? inventoryResult.value
      : [];

  const analytics =
    analyticsResult.status === "fulfilled"
      ? analyticsResult.value
      : null;

  // Calculate inventory statistics.
  const totalItems = items.length;

  const rawMaterials = items.filter(
    (item) => item.category === "raw_material"
  ).length;

  const finishedProducts = items.filter(
    (item) => item.category === "finished_product"
  ).length;

  // Find items at or below minimum stock.
  const lowStockItems = items
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

  // Prepare inventory statistics cards.
  const stats = [
    {
      title: "Total Items",
      value: totalItems,
      icon: Package,
    },
    {
      title: "Raw Materials",
      value: rawMaterials,
      icon: Wheat,
    },
    {
      title: "Finished Products",
      value: finishedProducts,
      icon: CakeSlice,
    },
    {
      title: "Low Stock",
      value: lowStockItems.length,
      icon: AlertTriangle,
    },
  ];

  // Log total server data preparation time.
  if (shouldMeasurePerformance) {
    console.info(
      `[Dashboard] ${period} days | Server data ready: ` +
        `${Math.round(
          performance.now() - pageStartedAt
        )}ms`
    );
  }

  return (
    <div className="bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Dashboard header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Smart Inventory
          </h1>

          <p className="mt-2 text-muted-foreground">
            Bakery Stock Monitoring Dashboard
          </p>
        </div>

        {/* Inventory error */}
        {inventoryError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive p-4 text-sm text-destructive"
          >
            {inventoryError}
          </div>
        ) : (
          <>
            {/* Inventory statistics */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <Card key={stat.title}>
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium">
                        {stat.title}
                      </CardTitle>

                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>

                    <CardContent>
                      <div className="text-3xl font-bold">
                        {stat.value}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Inventory table */}
            <Card>
              <CardHeader>
                <CardTitle>Inventory List</CardTitle>

                <p className="text-sm text-muted-foreground">
                  Data stok langsung dari Supabase.
                </p>
              </CardHeader>

              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Current Stock</TableHead>
                        <TableHead>Minimum Stock</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {items.map((item) => {
                        const currentStock = Number(
                          item.current_stock
                        );

                        const minimumStock = Number(
                          item.minimum_stock
                        );

                        const isLow =
                          currentStock <= minimumStock;

                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">
                              {item.name}
                            </TableCell>

                            <TableCell>
                              {item.category === "raw_material"
                                ? "Raw Material"
                                : "Finished Product"}
                            </TableCell>

                            <TableCell>
                              {currentStock} {item.unit}
                            </TableCell>

                            <TableCell>
                              {minimumStock} {item.unit}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={
                                  isLow
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {isLow
                                  ? "Restock"
                                  : "Sufficient"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {items.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-8 text-center text-muted-foreground"
                          >
                            Belum ada data inventory.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Analytics section */}
        <section className="space-y-6">
          {/* Analytics header and period filter */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <BarChart3 className="h-5 w-5" />
                Transaction Analytics
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Monitor stock activity over time.
              </p>
            </div>

            {/* Date range filter */}
            <div
              role="group"
              aria-label="Analytics period"
              className="flex w-fit items-center gap-2"
            >
              <Link
                href="/dashboard?period=7"
                prefetch={false}
                aria-current={
                  period === 7 ? "page" : undefined
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  period === 7
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                7 Days
              </Link>

              <Link
                href="/dashboard?period=30"
                prefetch={false}
                aria-current={
                  period === 30 ? "page" : undefined
                }
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                  period === 30
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }`}
              >
                30 Days
              </Link>
            </div>
          </div>

          {/* Analytics error */}
          {analyticsError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive p-4 text-sm text-destructive"
            >
              {analyticsError}
            </div>
          )}

          {/* Transaction analytics and stock alerts */}
          {analytics && !inventoryError && (
            <InventoryAnalytics
              period={period}
              data={{
                totals: analytics.totals,
                daily: analytics.daily,
                lowStock: lowStockItems,
                lowStockCount: lowStockItems.length,
              }}
            />
          )}

          {/* Top used materials and waste monitoring */}
          {analytics && (
            <InventoryInsights
              period={period}
              topUsedMaterials={analytics.topUsedMaterials}
              wasteMonitoring={analytics.wasteMonitoring}
            />
          )}

          {/* Explain unavailable stock alerts */}
          {analytics && inventoryError && (
            <div
              role="status"
              className="rounded-lg border p-4 text-sm text-muted-foreground"
            >
              Informasi Low Stock Alerts belum dapat
              ditampilkan karena data inventory gagal dimuat.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
