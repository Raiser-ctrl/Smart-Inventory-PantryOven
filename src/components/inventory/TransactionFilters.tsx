
"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  CalendarDays,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ArchiveStatus = "active" | "archived" | "all";

type Props = {
  search: string;
  type: string;
  status: ArchiveStatus;
  period: string;
  startDate: string;
  endDate: string;
};

type FilterValues = Props;

const PERIODS = [
  "today",
  "7days",
  "30days",
  "this_month",
  "last_month",
  "all",
  "custom",
] as const;

function buildUrl(values: FilterValues) {
  const params = new URLSearchParams();

  const normalizedSearch = values.search
    .trim()
    .slice(0, 100);

  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  if (values.type !== "all") {
    params.set("type", values.type);
  }

  if (values.status !== "active") {
    params.set("status", values.status);
  }

  if (values.period !== "this_month") {
    params.set("period", values.period);
  }

  if (values.period === "custom") {
    if (values.startDate) {
      params.set("startDate", values.startDate);
    }

    if (values.endDate) {
      params.set("endDate", values.endDate);
    }
  }

  params.set("page", "1");

  return `/transactions?${params.toString()}`;
}

export default function TransactionFilters({
  search,
  type,
  status,
  period,
  startDate,
  endDate,
}: Props) {
  const router = useRouter();

  const selectedPeriod = PERIODS.includes(
    period as (typeof PERIODS)[number]
  )
    ? period
    : "this_month";

  const [searchValue, setSearchValue] =
    useState(search);

  const [pendingSearch, setPendingSearch] =
    useState<string | null>(null);

  const searchTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  const latestValuesRef = useRef<FilterValues>({
    search,
    type,
    status,
    period: selectedPeriod,
    startDate,
    endDate,
  });

// Sync the latest server-provided filters after render.
useEffect(() => {
  latestValuesRef.current = {
    search,
    type,
    status,
    period: selectedPeriod,
    startDate,
    endDate,
  };
}, [
  search,
  type,
  status,
  selectedPeriod,
  startDate,
  endDate,
]);
  

  function cancelPendingSearch() {
    if (searchTimeoutRef.current !== undefined) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = undefined;
    }

    setPendingSearch(null);
  }

  // Debounce only while typing in the search field.
  useEffect(() => {
    if (pendingSearch === null) {
      return;
    }

    const normalizedPending = pendingSearch
      .trim()
      .slice(0, 100);

    if (normalizedPending === search.trim()) {
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      const current = latestValuesRef.current;

      router.replace(
        buildUrl({
          ...current,
          search: pendingSearch,
        }),
        { scroll: false }
      );

      searchTimeoutRef.current = undefined;
    }, 400);

    return () => {
      if (searchTimeoutRef.current !== undefined) {
        clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = undefined;
      }
    };
  }, [pendingSearch, search, router]);

  function updateFilters(
    changes: Partial<FilterValues>
  ) {
    cancelPendingSearch();

    router.replace(
      buildUrl({
        ...latestValuesRef.current,
        search: searchValue,
        ...changes,
      }),
      { scroll: false }
    );
  }

  function handleSearchChange(value: string) {
    setSearchValue(value);
    setPendingSearch(value);
  }

  function resetFilters() {
    cancelPendingSearch();
    setSearchValue("");

    router.replace(
      buildUrl({
        search: "",
        type: "all",
        status,
        period: "this_month",
        startDate: "",
        endDate: "",
      }),
      { scroll: false }
    );
  }

  const hasActiveFilters =
    searchValue.trim() !== "" ||
    type !== "all" ||
    selectedPeriod !== "this_month";

  return (
    <section
      aria-label="Transaction filters"
      className="min-w-0 rounded-xl border bg-card p-3.5 sm:p-4"
    >
      <div className="flex flex-col gap-3">
        {/* Search and dropdowns */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />

            <Input
              type="search"
              value={searchValue}
              onChange={(event) =>
                handleSearchChange(event.target.value)
              }
              placeholder="Search item name..."
              aria-label="Search transactions by item name"
              maxLength={100}
              className="h-11 min-w-0 pl-9 pr-10 text-base sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />

            {searchValue && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setSearchValue("");
                  updateFilters({ search: "" });
                }}
                className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X
                  aria-hidden="true"
                  className="size-4"
                />
              </button>
            )}
          </div>

          <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:flex lg:items-center">
            {/* Transaction type */}
            <Select
              value={type}
              onValueChange={(value) =>
                updateFilters({ type: value })
              }
            >
              <SelectTrigger
                aria-label="Transaction type"
                className="h-11 w-full min-w-0 lg:w-[185px]"
              >
                <SelectValue placeholder="Type" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All Transactions
                </SelectItem>
                <SelectItem value="stock_in">
                  Stock In
                </SelectItem>
                <SelectItem value="stock_out">
                  Stock Out
                </SelectItem>
                <SelectItem value="usage">
                  Usage
                </SelectItem>
                <SelectItem value="waste">
                  Waste
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Period */}
            <Select
              value={selectedPeriod}
              onValueChange={(value) =>
                updateFilters({
                  period: value,
                  startDate:
                    value === "custom" ? startDate : "",
                  endDate:
                    value === "custom" ? endDate : "",
                })
              }
            >
              <SelectTrigger
                aria-label="Transaction period"
                className="h-11 w-full min-w-0 lg:w-[190px]"
              >
                <CalendarDays
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <SelectValue placeholder="Period" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="today">
                  Today
                </SelectItem>
                <SelectItem value="7days">
                  Last 7 Days
                </SelectItem>
                <SelectItem value="30days">
                  Last 30 Days
                </SelectItem>
                <SelectItem value="this_month">
                  This Month
                </SelectItem>
                <SelectItem value="last_month">
                  Last Month
                </SelectItem>
                <SelectItem value="all">
                  All Time
                </SelectItem>
                <SelectItem value="custom">
                  Custom Range
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Custom date range */}
        {selectedPeriod === "custom" && (
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-1.5">
              <label
                htmlFor="transaction-start-date"
                className="text-xs font-medium text-muted-foreground"
              >
                From
              </label>

              <Input
                id="transaction-start-date"
                type="date"
                value={startDate}
                max={endDate || undefined}
                onChange={(event) =>
                  updateFilters({
                    startDate: event.target.value,
                  })
                }
                className="h-11 w-full min-w-0 text-base sm:text-sm"
              />
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <label
                htmlFor="transaction-end-date"
                className="text-xs font-medium text-muted-foreground"
              >
                To
              </label>

              <Input
                id="transaction-end-date"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) =>
                  updateFilters({
                    endDate: event.target.value,
                  })
                }
                className="h-11 w-full min-w-0 text-base sm:text-sm"
              />
            </div>

            {(startDate || endDate) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  updateFilters({
                    startDate: "",
                    endDate: "",
                  })
                }
                className="min-h-11 self-start sm:self-auto"
              >
                Clear dates
              </Button>
            )}
          </div>
        )}

        {/* Reset filters */}
        {hasActiveFilters && (
          <div className="flex items-center justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="min-h-11 gap-2 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw
                aria-hidden="true"
                className="size-3.5"
              />
              Reset filters
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
