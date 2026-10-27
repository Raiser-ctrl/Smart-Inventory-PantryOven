
import Link from "next/link";
import {
  Package,
  AlertTriangle,
  History,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory";

import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { EditItemDialog } from "@/components/inventory/EditItemDialog";
import { DeleteItemDialog } from "@/components/inventory/DeleteItemDialog";
import StockTransactionDialog from "@/components/inventory/StockTransactionDialog";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function InventoryPage() {
  // Verify admin access before fetching data.
  await requireAdmin();

  // Fetch inventory data.
  let items: Awaited<ReturnType<typeof getInventoryItems>> = [];
  let errorMessage = "";

  try {
    items = await getInventoryItems();
  } catch (error) {
    console.error("Inventory page error:", error);
    errorMessage = "Data inventory belum dapat dimuat.";
  }

  // Calculate inventory statistics.
  const lowStock = items.filter(
    (item) =>
      Number(item.current_stock) <=
      Number(item.minimum_stock)
  ).length;

  // Prepare transaction dialog data.
  const transactionItems = items.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    current_stock: Number(item.current_stock),
  }));

  return (
    <div className="bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Inventory Management
            </h1>

            <p className="mt-2 text-muted-foreground">
              Manage your bakery ingredients and products.
            </p>
          </div>

          {/* Inventory actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/transactions">
                <History className="mr-2 h-4 w-4" />
                Transaction History
              </Link>
            </Button>

            {!errorMessage && (
              <StockTransactionDialog
                items={transactionItems}
              />
            )}

            <AddItemDialog />
          </div>
        </div>

        {/* Inventory error */}
        {errorMessage ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive p-4 text-destructive"
          >
            {errorMessage}
          </div>
        ) : (
          <>
            {/* Inventory statistics */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Total Items
                  </CardTitle>

                  <Package className="h-5 w-5 text-muted-foreground" />
                </CardHeader>

                <CardContent>
                  <p className="text-3xl font-bold">
                    {items.length}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    Low Stock
                  </CardTitle>

                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                </CardHeader>

                <CardContent>
                  <p className="text-3xl font-bold">
                    {lowStock}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Inventory table */}
            <Card>
              <CardHeader>
                <CardTitle>All Inventory</CardTitle>

                <p className="text-sm text-muted-foreground">
                  Current inventory data from Supabase.
                </p>
              </CardHeader>

              <CardContent>
                <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Minimum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">
                          Actions
                        </TableHead>
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

                            <TableCell className="whitespace-nowrap">
                              {currentStock} {item.unit}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
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

                            <TableCell>
                              <div className="flex items-center justify-end gap-2">
                                <EditItemDialog
                                  item={{
                                    id: item.id,
                                    name: item.name,
                                    category: item.category,
                                    unit: item.unit,
                                    minimum_stock: minimumStock,
                                  }}
                                />

                                <DeleteItemDialog
                                  item={{
                                    id: item.id,
                                    name: item.name,
                                  }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {items.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-10 text-center text-muted-foreground"
                          >
                            No inventory items found.
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
      </div>
    </div>
  );
}
