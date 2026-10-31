
import Link from "next/link";

import {
  redirect,
  unstable_rethrow,
} from "next/navigation";

import {
  ChevronLeft,
  ChevronRight,
  History,
} from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

import {
  normalizePeriod,
  resolveTransactionPeriod,
  jakartaDateBoundary,
} from "@/lib/transaction-period";

import TransactionFilters from "@/components/inventory/TransactionFilters";
import TransactionExport from "@/components/inventory/TransactionExport";
import TransactionHistoryList from "@/components/inventory/TransactionHistoryList";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

type TransactionType =
  | "stock_in"
  | "stock_out"
  | "usage"
  | "waste";

type ArchiveStatus = "active" | "archived" | "all";

type PageProps = {
  searchParams: Promise<{
    search?: string | string[];
    type?: string | string[];
    status?: string | string[];
    period?: string | string[];
    page?: string | string[];
    startDate?: string | string[];
    endDate?: string | string[];
  }>;
};

type HistoryRow = {
  id: string;
  item_id: string;
  transaction_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  itemName: string;
  unit: string;
  itemArchivedAt: string | null;
};

const PAGE_SIZE = 10;

const validTypes: TransactionType[] = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
];

const quantityFormatter = new Intl.NumberFormat(
  "id-ID",
  {
    maximumFractionDigits: 2,
  }
);

function getFirstParam(
  value?: string | string[]
) {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

function escapeLike(value: string) {
  return value.replace(
    /[\\%_]/g,
    "\\$&"
  );
}

function buildPageUrl(
  search: string,
  type: string,
  status: ArchiveStatus,
  period: string,
  customStartDate: string,
  customEndDate: string,
  targetPage: number
) {
  const query = new URLSearchParams();

  if (search) {
    query.set("search", search);
  }

  if (type !== "all") {
    query.set("type", type);
  }

  if (status !== "active") {
    query.set("status", status);
  }

  if (period !== "this_month") {
    query.set("period", period);
  }

  if (period === "custom") {
    if (customStartDate) {
      query.set("startDate", customStartDate);
    }

    if (customEndDate) {
      query.set("endDate", customEndDate);
    }
  }

  query.set("page", String(targetPage));

  return `/transactions?${query.toString()}`;
}

export default async function TransactionsPage({
  searchParams,
}: PageProps) {
  await requireAdmin();

  const params = await searchParams;

  const search = getFirstParam(params.search)
    .trim()
    .slice(0, 100);

  const requestedType =
    getFirstParam(params.type) || "all";

  const type =
    requestedType === "all" ||
    validTypes.includes(
      requestedType as TransactionType
    )
      ? requestedType
      : "all";

  const requestedStatus =
    getFirstParam(params.status) || "active";

  const status: ArchiveStatus =
    requestedStatus === "archived" ||
    requestedStatus === "all"
      ? requestedStatus
      : "active";

  const period = normalizePeriod(
    getFirstParam(params.period)
  );

  const customStartDate =
    period === "custom"
      ? getFirstParam(params.startDate)
      : "";

  const customEndDate =
    period === "custom"
      ? getFirstParam(params.endDate)
      : "";

  const {
    startDate,
    endDate,
    hasInvalidRange,
  } = resolveTransactionPeriod(
    period,
    customStartDate,
    customEndDate
  );

  const requestedPage = Number(
    getFirstParam(params.page) || "1"
  );

  const page =
    Number.isSafeInteger(requestedPage) &&
    requestedPage > 0
      ? requestedPage
      : 1;

  const pageUrl = (targetPage: number) =>
    buildPageUrl(
      search,
      type,
      status,
      period,
      customStartDate,
      customEndDate,
      targetPage
    );

  const statusUrl = (
    targetStatus: ArchiveStatus
  ) =>
    buildPageUrl(
      search,
      type,
      targetStatus,
      period,
      customStartDate,
      customEndDate,
      1
    );

  let history: HistoryRow[] = [];
  let total = 0;
  let errorMessage = "";

  try {
    // ======================================
    // SEARCH ITEMS
    // ======================================

    let matchingItemIds: string[] | null = null;

    if (search && !hasInvalidRange) {
      const safeSearch = escapeLike(search);

      const { data, error } = await supabaseAdmin
        .from("items")
        .select("id")
        .ilike("name", `%${safeSearch}%`);

      if (error) {
        throw error;
      }

      matchingItemIds = (data ?? []).map(
        (item) => item.id
      );
    }

    if (
      !hasInvalidRange &&
      (
        matchingItemIds === null ||
        matchingItemIds.length > 0
      )
    ) {
      // ====================================
      // COUNT TRANSACTIONS
      // ====================================

      let countQuery = supabaseAdmin
        .from("stock_transactions")
        .select(
          "id, item:items!inner(archived_at)",
          {
            count: "exact",
            head: true,
          }
        );

      if (type !== "all") {
        countQuery = countQuery.eq(
          "transaction_type",
          type
        );
      }

      if (matchingItemIds !== null) {
        countQuery = countQuery.in(
          "item_id",
          matchingItemIds
        );
      }

      if (startDate) {
        countQuery = countQuery.gte(
          "created_at",
          jakartaDateBoundary(startDate)
        );
      }

      if (endDate) {
        countQuery = countQuery.lt(
          "created_at",
          jakartaDateBoundary(endDate, true)
        );
      }

      if (status === "active") {
        countQuery = countQuery.is(
          "item.archived_at",
          null
        );
      } else if (status === "archived") {
        countQuery = countQuery.not(
          "item.archived_at",
          "is",
          null
        );
      }

      const {
        count,
        error: countError,
      } = await countQuery;

      if (countError) {
        throw countError;
      }

      total = count ?? 0;

      if (total > 0) {
        const totalPages = Math.ceil(
          total / PAGE_SIZE
        );

        if (page > totalPages) {
          redirect(pageUrl(totalPages));
        }

        // ==================================
        // FETCH TRANSACTIONS
        // ==================================

        let query = supabaseAdmin
          .from("stock_transactions")
          .select(
            `
              id,
              item_id,
              transaction_type,
              quantity,
              notes,
              created_at,
              item:items!inner (
                name,
                unit,
                archived_at
              )
            `
          );

        if (type !== "all") {
          query = query.eq(
            "transaction_type",
            type
          );
        }

        if (matchingItemIds !== null) {
          query = query.in(
            "item_id",
            matchingItemIds
          );
        }

        if (startDate) {
          query = query.gte(
            "created_at",
            jakartaDateBoundary(startDate)
          );
        }

        if (endDate) {
          query = query.lt(
            "created_at",
            jakartaDateBoundary(endDate, true)
          );
        }

        if (status === "active") {
          query = query.is(
            "item.archived_at",
            null
          );
        } else if (status === "archived") {
          query = query.not(
            "item.archived_at",
            "is",
            null
          );
        }

        const from = (page - 1) * PAGE_SIZE;

        const {
          data,
          error,
        } = await query
          .order("created_at", {
            ascending: false,
          })
          .order("id", {
            ascending: false,
          })
          .range(
            from,
            from + PAGE_SIZE - 1
          );

        if (error) {
          throw error;
        }

        // ==================================
        // FORMAT HISTORY
        // ==================================

        history = (data ?? []).map((row) => {
          const itemRelation = row.item;

          const item = Array.isArray(itemRelation)
            ? itemRelation[0]
            : itemRelation;

          return {
            id: row.id,
            item_id: row.item_id,
            transaction_type:
              row.transaction_type,
            quantity: Number(row.quantity),
            notes: row.notes,
            created_at: row.created_at,
            itemName:
              item?.name ?? "Unknown Item",
            unit: item?.unit ?? "",
            itemArchivedAt:
              item?.archived_at ?? null,
          };
        });
      }
    }
  } catch (error) {
    unstable_rethrow(error);

    console.error(
      "Transactions page error:",
      error
    );

    errorMessage =
      "Riwayat transaksi belum dapat dimuat.";
  }

  // ======================================
  // PAGINATION
  // ======================================

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );

  if (!errorMessage && page > totalPages) {
    redirect(pageUrl(totalPages));
  }

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  const showingFrom =
    total === 0
      ? 0
      : (page - 1) * PAGE_SIZE + 1;

  const showingTo = Math.min(
    page * PAGE_SIZE,
    total
  );

  const statusTabs: {
    value: ArchiveStatus;
    label: string;
  }[] = [
    { value: "active", label: "Active" },
    { value: "archived", label: "Archived" },
    { value: "all", label: "All" },
  ];

  const sectionTitle =
    status === "active"
      ? "Active Transactions"
      : status === "archived"
        ? "Archived Transactions"
        : "All Transactions";

  return (
    <main className="min-w-0 bg-background px-4 py-5 sm:px-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ==================================
            PAGE HEADER
        ================================== */}

        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight md:text-3xl">
              <History className="size-7 shrink-0" />
              Transaction History
            </h1>

            <p className="text-sm text-muted-foreground">
              Search, filter, and review stock movements.
            </p>
          </div>

          <TransactionExport
            search={search}
            type={type}
            status={status}
            startDate={startDate}
            endDate={endDate}
          />
        </header>

        {/* ==================================
            FILTERS
        ================================== */}

        <TransactionFilters
          key={`${search}:${type}:${status}:${period}:${customStartDate}:${customEndDate}`}
          search={search}
          type={type}
          status={status}
          period={period}
          startDate={customStartDate}
          endDate={customEndDate}
        />

        {/* ==================================
            ARCHIVE STATUS TABS
        ================================== */}

        <nav
          className="flex flex-wrap items-center gap-2"
          aria-label="Transaction archive status"
        >
          {statusTabs.map((tab) => {
            const isSelected =
              status === tab.value;

            return (
              <Button
                key={tab.value}
                asChild
                size="sm"
                variant={
                  isSelected
                    ? "default"
                    : "outline"
                }
              >
                <Link
                  href={statusUrl(tab.value)}
                  aria-current={
                    isSelected
                      ? "page"
                      : undefined
                  }
                >
                  {tab.label}
                </Link>
              </Button>
            );
          })}
        </nav>

        {/* ==================================
            TRANSACTION HISTORY
        ================================== */}

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="space-y-1 border-b pb-4">
            <CardTitle className="text-base font-semibold sm:text-lg">
              {sectionTitle}
            </CardTitle>

            {!errorMessage && (
              <p className="text-sm text-muted-foreground">
                {quantityFormatter.format(total)}{" "}
                transaction
                {total === 1 ? "" : "s"} found
              </p>
            )}
          </CardHeader>

          <CardContent className="space-y-5">
            {errorMessage ? (
              <div
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
              >
                {errorMessage}
              </div>
            ) : (
              <>
                <TransactionHistoryList
                  history={history}
                  status={status}
                  hasInvalidRange={hasInvalidRange}
                />

                {/* ==========================
                    PAGINATION
                ========================== */}

                <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      Page {page} of {totalPages}
                    </p>

                    <p className="text-xs text-muted-foreground">
                      {total === 0
                        ? "Showing 0 transactions"
                        : `Showing ${showingFrom}–${showingTo} of ${quantityFormatter.format(total)} transactions`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {canGoPrevious ? (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link
                          href={pageUrl(page - 1)}
                        >
                          <ChevronLeft className="size-4" />
                          Previous
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        <ChevronLeft className="size-4" />
                        Previous
                      </Button>
                    )}

                    {canGoNext ? (
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <Link
                          href={pageUrl(page + 1)}
                        >
                          Next
                          <ChevronRight className="size-4" />
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                      >
                        Next
                        <ChevronRight className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
