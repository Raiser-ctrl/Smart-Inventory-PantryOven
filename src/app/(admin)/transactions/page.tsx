
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

import TransactionFilters from "@/components/inventory/TransactionFilters";

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

export const dynamic = "force-dynamic";

type TransactionType =
  | "stock_in"
  | "stock_out"
  | "usage"
  | "waste";

const validTypes: TransactionType[] = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
];

const typeLabels: Record<TransactionType, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  usage: "Usage",
  waste: "Waste",
};

type PageProps = {
  searchParams: Promise<{
    search?: string;
    type?: string;
    page?: string;
  }>;
};

const PAGE_SIZE = 10;

export default async function TransactionsPage({
  searchParams,
}: PageProps) {
  // Verify admin access before accessing transactions.
  await requireAdmin();

  // Read and normalize URL parameters.
  const params = await searchParams;

  const search = (params.search ?? "")
    .trim()
    .slice(0, 100);

  const requestedType = params.type ?? "all";

  const type =
    requestedType === "all" ||
    validTypes.includes(requestedType as TransactionType)
      ? requestedType
      : "all";

  const parsedPage = Number(params.page ?? "1");

  const page =
    Number.isSafeInteger(parsedPage) && parsedPage > 0
      ? parsedPage
      : 1;

  let errorMessage = "";
  let total = 0;

  type HistoryRow = {
    id: string;
    item_id: string;
    transaction_type: string;
    quantity: number;
    notes: string | null;
    created_at: string;
    itemName: string;
    unit: string;
  };

  let history: HistoryRow[] = [];

  try {
    // Find items matching the search.
    let matchingItemIds: string[] | null = null;

    if (search) {
      const { data, error } = await supabaseAdmin
        .from("items")
        .select("id")
        .ilike("name", `%${search}%`);

      if (error) throw error;

      matchingItemIds = (data ?? []).map(
        (item) => item.id
      );
    }

    if (matchingItemIds?.length !== 0) {
      // Build filtered transaction query.
      let query = supabaseAdmin
        .from("stock_transactions")
        .select(
          "id, item_id, transaction_type, quantity, notes, created_at",
          { count: "exact" }
        );

      if (type !== "all") {
        query = query.eq("transaction_type", type);
      }

      if (matchingItemIds !== null) {
        query = query.in(
          "item_id",
          matchingItemIds
        );
      }

      // Fetch the requested page.
      const from = (page - 1) * PAGE_SIZE;

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      total = count ?? 0;

      // Fetch item information for displayed rows.
      const itemIds = [
        ...new Set(
          (data ?? []).map((row) => row.item_id)
        ),
      ];

      let itemMap = new Map<
        string,
        { name: string; unit: string }
      >();

      if (itemIds.length > 0) {
        const {
          data: items,
          error: itemsError,
        } = await supabaseAdmin
          .from("items")
          .select("id, name, unit")
          .in("id", itemIds);

        if (itemsError) throw itemsError;

        itemMap = new Map(
          (items ?? []).map((item) => [
            item.id,
            {
              name: item.name,
              unit: item.unit,
            },
          ])
        );
      }

      history = (data ?? []).map((row) => {
        const item = itemMap.get(row.item_id);

        return {
          ...row,
          itemName: item?.name ?? "Unknown Item",
          unit: item?.unit ?? "",
        };
      });
    }
  } catch (error) {
    console.error(
      "Transactions page error:",
      error
    );

    errorMessage =
      "Riwayat transaksi belum dapat dimuat.";
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Build pagination URLs while preserving filters.
  function pageUrl(targetPage: number) {
    const query = new URLSearchParams();

    if (search) {
      query.set("search", search);
    }

    if (type !== "all") {
      query.set("type", type);
    }

    query.set("page", String(targetPage));

    return `/transactions?${query.toString()}`;
  }

  return (
    <div className="bg-background px-4 py-8 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Page header */}
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <History className="h-8 w-8" />
            Transaction History
          </h1>

          <p className="mt-2 text-muted-foreground">
            Search, filter, and review stock movements.
          </p>
        </div>

        {/* Search and transaction filters */}
        <TransactionFilters
          search={search}
          type={type}
        />

        {/* Transaction history table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Recent Transactions
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              {total} transaction(s) found.
            </p>
          </CardHeader>

          <CardContent>
            {errorMessage ? (
              <p
                role="alert"
                className="text-sm text-destructive"
              >
                {errorMessage}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {history.map((transaction) => {
                        const transactionType =
                          transaction.transaction_type as TransactionType;

                        const isIncoming =
                          transactionType === "stock_in";

                        return (
                          <TableRow key={transaction.id}>
                            <TableCell className="font-medium">
                              {transaction.itemName}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={
                                  isIncoming
                                    ? "secondary"
                                    : "outline"
                                }
                              >
                                {typeLabels[transactionType] ??
                                  transactionType}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              <span
                                className={
                                  isIncoming
                                    ? "font-medium text-green-600"
                                    : "font-medium text-orange-600"
                                }
                              >
                                {isIncoming ? "+" : "−"}
                                {transaction.quantity}{" "}
                                {transaction.unit}
                              </span>
                            </TableCell>

                            <TableCell className="max-w-[240px] truncate">
                              {transaction.notes || "—"}
                            </TableCell>

                            <TableCell className="whitespace-nowrap">
                              {new Intl.DateTimeFormat(
                                "id-ID",
                                {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                  timeZone: "Asia/Jakarta",
                                }
                              ).format(
                                new Date(
                                  transaction.created_at
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {history.length === 0 && (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-10 text-center text-muted-foreground"
                          >
                            Tidak ada transaksi yang cocok.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination controls */}
                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {page} of{" "}
                    {Math.max(totalPages, 1)}
                  </p>

                  <div className="flex items-center gap-2">
                    {page > 1 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link
                          href={pageUrl(page - 1)}
                        >
                          <ChevronLeft className="mr-1 h-4 w-4" />
                          Previous
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Previous
                      </Button>
                    )}

                    {page < totalPages ? (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link
                          href={pageUrl(page + 1)}
                        >
                          Next
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        Next
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
