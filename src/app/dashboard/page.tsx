
import { requireAdmin } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory";
import { getInventoryAnalytics } from "@/lib/inventory-analytics";

import InventoryAnalytics from "@/components/dashboard/InventoryAnalytics";

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
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  // Verify admin access.
  await requireAdmin();

  let items: Awaited<ReturnType<typeof getInventoryItems>> = [];
  let inventoryError = "";
  let analyticsError = "";

  // Fetch inventory items.
  try {
    items = await getInventoryItems();
  } catch (error) {
    console.error("Dashboard inventory error:", error);
    inventoryError = "Data inventory belum dapat dimuat.";
  }

  // Fetch transaction analytics.
  let analytics: Awaited<
    ReturnType<typeof getInventoryAnalytics>
  > | null = null;

  try {
    analytics = await getInventoryAnalytics();
  } catch (error) {
    console.error("Dashboard analytics error:", error);
    analyticsError = "Data analytics belum dapat dimuat.";
  }

  // Calculate inventory statistics.
  const totalItems = items.length;

  const rawMaterials = items.filter(
    (item) => item.category === "raw_material"
  ).length;

  const finishedProducts = items.filter(
    (item) => item.category === "finished_product"
  ).length;

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

  return (
    <main className="min-h-screen bg-background px-4 py-8 md:px-8">
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

        {/* Transaction analytics */}
        {analyticsError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive p-4 text-sm text-destructive"
          >
            {analyticsError}
          </div>
        ) : analytics ? (
          <InventoryAnalytics
            data={{
              totals: analytics.totals,
              daily: analytics.daily,
              lowStock: lowStockItems,
              lowStockCount: lowStockItems.length,
            }}
          />
        ) : null}
      </div>
    </main>
  );
}
