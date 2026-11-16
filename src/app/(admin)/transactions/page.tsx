
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

import { requireApprovedUser } from "@/lib/auth";
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
const MAX_SEARCH_LENGTH = 100;

const VALID_TYPES: readonly TransactionType[] = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
];

const numberFormatter = new Intl.NumberFormat(
  "id-ID",
  {
    maximumFractionDigits: 0,
  }
);

function getFirstParam(
  value?: string | string[]
): string {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
}

function normalizeTransactionType(
  value: string
): string {
  if (
    value === "all" ||
    VALID_TYPES.includes(value as TransactionType)
  ) {
    return value;
  }

  return "all";
}

function normalizeArchiveStatus(
  value: string
): ArchiveStatus {
  if (value === "archived" || value === "all") {
    return value;
  }

  return "active";
}

// Escape LIKE wildcard characters in item-name searches.
function escapeLike(value: string): string {
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
): string {
  const params = new URLSearchParams();

  if (search) {
    params.set("search", search);
  }

  if (type !== "all") {
    params.set("type", type);
  }

  if (status !== "active") {
    params.set("status", status);
  }

  if (period !== "this_month") {
    params.set("period", period);
  }

  if (period === "custom") {
    if (customStartDate) {
      params.set("startDate", customStartDate);
    }

    if (customEndDate) {
      params.set("endDate", customEndDate);
    }
  }

  params.set(
    "page",
    String(Math.max(1, targetPage))
  );

  return `/transactions?${params.toString()}`;
}

export default async function TransactionsPage({
  searchParams,
}: PageProps) {
  // Authentication and authorization.
  // Only approved users can access this page.
  await requireApprovedUser();

  const params = await searchParams;

  // Normalize query parameters.
  const search = getFirstParam(params.search)
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);

  const type = normalizeTransactionType(
    getFirstParam(params.type) || "all"
  );

  const status = normalizeArchiveStatus(
    getFirstParam(params.status) || "active"
  );

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

  const rawPage = getFirstParam(params.page);

  const requestedPage = Number(rawPage || "1");

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
    let matchingItemIds: string[] | null = null;

    // Search inventory items by name.
    if (search && !hasInvalidRange) {
      const safeSearch = escapeLike(search);

      const {
        data: matchingItems,
        error: searchError,
      } = await supabaseAdmin
        .from("items")
        .select("id")
        .ilike(
          "name",
          `%${safeSearch}%`
        );

      if (searchError) {
        throw searchError;
      }

      matchingItemIds = (
        matchingItems ?? []
      ).map((item) => item.id);
    }

    const shouldFetch =
      !hasInvalidRange &&
      (
        matchingItemIds === null ||
        matchingItemIds.length > 0
      );

    if (shouldFetch) {
      // Count transactions matching filters.
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
          jakartaDateBoundary(
            endDate,
            true
          )
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
        const availablePages = Math.ceil(
          total / PAGE_SIZE
        );

        // Redirect before querying an invalid page.
        if (page > availablePages) {
          redirect(pageUrl(availablePages));
        }

        // Fetch transaction history.
        let historyQuery = supabaseAdmin
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
          historyQuery = historyQuery.eq(
            "transaction_type",
            type
          );
        }

        if (matchingItemIds !== null) {
          historyQuery = historyQuery.in(
            "item_id",
            matchingItemIds
          );
        }

        if (startDate) {
          historyQuery = historyQuery.gte(
            "created_at",
            jakartaDateBoundary(startDate)
          );
        }

        if (endDate) {
          historyQuery = historyQuery.lt(
            "created_at",
            jakartaDateBoundary(
              endDate,
              true
            )
          );
        }

        if (status === "active") {
          historyQuery = historyQuery.is(
            "item.archived_at",
            null
          );
        } else if (status === "archived") {
          historyQuery = historyQuery.not(
            "item.archived_at",
            "is",
            null
          );
        }

        const from = (page - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const {
          data,
          error: historyError,
        } = await historyQuery
          .order("created_at", {
            ascending: false,
          })
          .order("id", {
            ascending: false,
          })
          .range(from, to);

        if (historyError) {
          throw historyError;
        }

        // Normalize Supabase response for the UI.
        history = (data ?? []).map((row) => {
          const relation = row.item;

          const item = Array.isArray(relation)
            ? relation[0]
            : relation;

          const numericQuantity = Number(
            row.quantity
          );

          return {
            id: row.id,
            item_id: row.item_id,
            transaction_type:
              row.transaction_type,
            quantity: Number.isFinite(
              numericQuantity
            )
              ? numericQuantity
              : 0,
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
    // Preserve Next.js redirects and internal errors.
    unstable_rethrow(error);

    console.error(
      "Transactions page error:",
      error
    );

    errorMessage =
      "Riwayat transaksi belum dapat dimuat.";
  }

  const totalPages = Math.max(
    1,
    Math.ceil(total / PAGE_SIZE)
  );

  // Handle an out-of-range page when there are
  // no matching transactions.
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
    {
      value: "active",
      label: "Active",
    },
    {
      value: "archived",
      label: "Archived",
    },
    {
      value: "all",
      label: "All",
    },
  ];

  const sectionTitle =
    status === "active"
      ? "Active Transactions"
      : status === "archived"
        ? "Archived Transactions"
        : "All Transactions";

  return (
    <main className="min-w-0 px-4 py-5 pb-28 text-[#343B32] sm:px-6 md:px-8 md:pt-8 lg:pb-8">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-6">
        {/* Page header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight md:text-3xl">
              <History
                aria-hidden="true"
                className="size-7 shrink-0 text-[#536D50]"
              />

              Transaction History
            </h1>

            <p className="text-sm text-[#5F705B]">
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

        {/* Filters */}
        <TransactionFilters
          key={`${search}:${type}:${status}:${period}:${customStartDate}:${customEndDate}`}
          search={search}
          type={type}
          status={status}
          period={period}
          startDate={customStartDate}
          endDate={customEndDate}
        />

        {/* Archive status tabs */}
        <nav
          className="grid grid-cols-3 gap-1 rounded-2xl border border-[#8FA58A]/20 bg-[#F8F6EF]/75 p-1 sm:w-fit sm:grid-cols-[repeat(3,minmax(6rem,1fr))]"
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
                variant="ghost"
                className={`min-h-11 rounded-xl px-2 focus-visible:ring-[#8FA58A]/45 ${
                  isSelected
                    ? "bg-white text-[#343B32] shadow-sm hover:bg-white"
                    : "text-[#536D50] hover:bg-white/70 hover:text-[#343B32]"
                }`}
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

        {/* Transaction history */}
        <Card className="min-w-0 overflow-hidden rounded-[26px] border border-white/55 bg-white/45 shadow-[0_10px_36px_rgba(52,59,50,0.045)] backdrop-blur-xl">
          <CardHeader className="space-y-1 border-b border-[#8FA58A]/15 bg-[#F8F6EF]/35 pb-4">
            <CardTitle className="text-base font-semibold sm:text-lg">
              {sectionTitle}
            </CardTitle>

            {!errorMessage && (
              <p className="text-sm text-[#5F705B]">
                {numberFormatter.format(total)}{" "}
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
                  hasInvalidRange={
                    hasInvalidRange
                  }
                />

                {totalPages > 1 && (
                  <div className="flex flex-col gap-3 border-t border-[#8FA58A]/15 pt-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">
                        Page {page} of {totalPages}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Showing {numberFormatter.format(showingFrom)}–{numberFormatter.format(showingTo)} of {numberFormatter.format(total)} transactions
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      {canGoPrevious ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 rounded-xl border-[#8FA58A]/25 bg-white/70 text-[#536D50] hover:bg-white hover:text-[#343B32] focus-visible:ring-[#8FA58A]/45"
                          asChild
                        >
                          <Link
                            href={pageUrl(page - 1)}
                          >
                            <ChevronLeft
                              aria-hidden="true"
                              className="size-4"
                            />
                            Previous
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 rounded-xl border-[#8FA58A]/25 bg-white/70 text-[#536D50] hover:bg-white hover:text-[#343B32] focus-visible:ring-[#8FA58A]/45"
                          disabled
                        >
                          <ChevronLeft
                            aria-hidden="true"
                            className="size-4"
                          />
                          Previous
                        </Button>
                      )}

                      {canGoNext ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 rounded-xl border-[#8FA58A]/25 bg-white/70 text-[#536D50] hover:bg-white hover:text-[#343B32] focus-visible:ring-[#8FA58A]/45"
                          asChild
                        >
                          <Link
                            href={pageUrl(page + 1)}
                          >
                            Next
                            <ChevronRight
                              aria-hidden="true"
                              className="size-4"
                            />
                          </Link>
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="min-h-11 rounded-xl border-[#8FA58A]/25 bg-white/70 text-[#536D50] hover:bg-white hover:text-[#343B32] focus-visible:ring-[#8FA58A]/45"
                          disabled
                        >
                          Next
                          <ChevronRight
                            aria-hidden="true"
                            className="size-4"
                          />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
