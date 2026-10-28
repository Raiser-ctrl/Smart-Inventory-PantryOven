
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
import { ArchiveItemDialog } from "@/components/inventory/ArchiveItemDialog";
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

type InventoryPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  // Verify admin access.
  await requireAdmin();

  // Read inventory filter from URL.
  const { status } = await searchParams;

  const activeFilter =
    status === "archived" || status === "all"
      ? status
      : "active";

  // Fetch inventory data.
  let items: Awaited<ReturnType<typeof getInventoryItems>> = [];
  let errorMessage = "";

  try {
    items = await getInventoryItems();
  } catch (error) {
    console.error("Inventory page error:", error);
    errorMessage = "Data inventory belum dapat dimuat.";
  }

  // Active and archived inventory.
  const activeItems = items.filter(
    (item) => item.archived_at === null
  );

  const archivedItems = items.filter(
    (item) => item.archived_at !== null
  );

  // Filter items displayed in the table.
  const filteredItems = items.filter((item) => {
    if (activeFilter === "active") {
      return item.archived_at === null;
    }

    if (activeFilter === "archived") {
      return item.archived_at !== null;
    }

    return true;
  });

  // Statistics only count active items.
  const lowStock = activeItems.filter(
    (item) =>
      Number(item.current_stock) <=
      Number(item.minimum_stock)
  ).length;

  // Only active items can be selected for transactions.
  const transactionItems = activeItems.map((item) => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    current_stock: Number(item.current_stock),
  }));

  const filters = [
    {
      label: "Active",
      value: "active",
      count: activeItems.length,
    },
    {
      label: "Archived",
      value: "archived",
      count: archivedItems.length,
    },
    {
      label: "All",
      value: "all",
      count: items.length,
    },
  ];

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
                    Total Active Items
                  </CardTitle>

                  <Package className="h-5 w-5 text-muted-foreground" />
                </CardHeader>

                <CardContent>
                  <p className="text-3xl font-bold">
                    {activeItems.length}
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
              <CardHeader className="space-y-4">
                <div>
                  <CardTitle>Inventory Items</CardTitle>

                  <p className="mt-2 text-sm text-muted-foreground">
                    View active and archived inventory items.
                  </p>
                </div>

                {/* Inventory status filters */}
                <div className="flex flex-wrap gap-2">
                  {filters.map((filter) => (
                    <Button
                      key={filter.value}
                      asChild
                      size="sm"
                      variant={
                        activeFilter === filter.value
                          ? "default"
                          : "outline"
                      }
                    >
                      <Link
                        href={`/inventory?status=${filter.value}`}
                      >
                        {filter.label} ({filter.count})
                      </Link>
                    </Button>
                  ))}
                </div>
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
                      {filteredItems.map((item) => {
                        const currentStock = Number(
                          item.current_stock
                        );

                        const minimumStock = Number(
                          item.minimum_stock
                        );

                        const isArchived =
                          item.archived_at !== null;

                        const isLow =
                          currentStock <= minimumStock;

                        return (
                          <TableRow
                            key={item.id}
                            className={
                              isArchived
                                ? "bg-muted/30"
                                : undefined
                            }
                          >
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
                              {isArchived ? (
                                <Badge variant="outline">
                                  Archived
                                </Badge>
                              ) : (
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
                              )}
                            </TableCell>

                            <TableCell>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {!isArchived && (
                                  <>
                                    <EditItemDialog
                                      item={{
                                        id: item.id,
                                        name: item.name,
                                        category: item.category,
                                        unit: item.unit,
                                        minimum_stock:
                                          minimumStock,
                                      }}
                                    />

                                    <DeleteItemDialog
                                      item={{
                                        id: item.id,
                                        name: item.name,
                                      }}
                                    />
                                  </>
                                )}

                                <ArchiveItemDialog
                                  item={{
                                    id: item.id,
                                    name: item.name,
                                    archived_at:
                                      item.archived_at,
                                  }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {filteredItems.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="py-10 text-center text-muted-foreground"
                          >
                            {activeFilter === "archived"
                              ? "No archived items found."
                              : activeFilter === "active"
                                ? "No active inventory items found."
                                : "No inventory items found."}
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
