
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

type TransactionType =
  | "all"
  | "stock_in"
  | "stock_out"
  | "usage"
  | "waste";

type Period =
  | "today"
  | "7days"
  | "30days"
  | "this_month"
  | "last_month"
  | "all"
  | "custom";

type Props = {
  search: string;
  type: string;
  status: ArchiveStatus;
  period: string;
  startDate: string;
  endDate: string;
};

type FilterValues = {
  search: string;
  type: TransactionType;
  status: ArchiveStatus;
  period: Period;
  startDate: string;
  endDate: string;
};

const MAX_SEARCH_LENGTH = 100;
const SEARCH_DEBOUNCE_MS = 400;

const PERIODS: readonly Period[] = [
  "today",
  "7days",
  "30days",
  "this_month",
  "last_month",
  "all",
  "custom",
];

const TRANSACTION_TYPES: readonly TransactionType[] = [
  "all",
  "stock_in",
  "stock_out",
  "usage",
  "waste",
];

function normalizePeriod(value: string): Period {
  return PERIODS.includes(value as Period)
    ? (value as Period)
    : "this_month";
}

function normalizeType(
  value: string
): TransactionType {
  return TRANSACTION_TYPES.includes(
    value as TransactionType
  )
    ? (value as TransactionType)
    : "all";
}

function isValidDate(value: string): boolean {
  if (!value) return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function normalizeFilters(
  values: FilterValues
): FilterValues {
  const normalizedPeriod = normalizePeriod(
    values.period
  );

  const normalizedStartDate = isValidDate(
    values.startDate
  )
    ? values.startDate
    : "";

  const normalizedEndDate = isValidDate(
    values.endDate
  )
    ? values.endDate
    : "";

  return {
    search: values.search
      .trim()
      .slice(0, MAX_SEARCH_LENGTH),

    type: normalizeType(values.type),
    status: values.status,
    period: normalizedPeriod,

    startDate:
      normalizedPeriod === "custom"
        ? normalizedStartDate
        : "",

    endDate:
      normalizedPeriod === "custom"
        ? normalizedEndDate
        : "",
  };
}

function buildUrl(values: FilterValues): string {
  const normalized = normalizeFilters(values);

  const params = new URLSearchParams();

  if (normalized.search) {
    params.set("search", normalized.search);
  }

  if (normalized.type !== "all") {
    params.set("type", normalized.type);
  }

  if (normalized.status !== "active") {
    params.set("status", normalized.status);
  }

  if (normalized.period !== "this_month") {
    params.set("period", normalized.period);
  }

  if (normalized.period === "custom") {
    if (normalized.startDate) {
      params.set(
        "startDate",
        normalized.startDate
      );
    }

    if (normalized.endDate) {
      params.set(
        "endDate",
        normalized.endDate
      );
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

  const selectedPeriod = normalizePeriod(period);
  const selectedType = normalizeType(type);

  const [searchValue, setSearchValue] =
    useState(search);

  const searchTimeoutRef = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  // Latest intended filters, including changes that
  // have not yet returned from the server.
  const latestValuesRef = useRef<FilterValues>({
    search,
    type: selectedType,
    status,
    period: selectedPeriod,
    startDate,
    endDate,
  });

  const searchValueRef = useRef(search);

  const pendingSearchRef = useRef(false);

  // Keep a stable reference to the last URL
  // requested by this component.
  const lastRequestedUrlRef = useRef<string | null>(
    null
  );

  // Sync values received after navigation.
  useEffect(() => {
    const nextValues: FilterValues = {
      search,
      type: normalizeType(type),
      status,
      period: normalizePeriod(period),
      startDate,
      endDate,
    };

    const incomingUrl = buildUrl(nextValues);

    // Do not overwrite a newer local search with
    // an older server response while debounce is active.
    if (pendingSearchRef.current) {
      return;
    }

    if (
      lastRequestedUrlRef.current !== null &&
      incomingUrl !== lastRequestedUrlRef.current
    ) {
      // Another navigation may have changed the URL.
      // The current props are authoritative once
      // there is no pending local search.
      lastRequestedUrlRef.current = null;
    }

    latestValuesRef.current = nextValues;
    searchValueRef.current = search;
  }, [
    search,
    type,
    status,
    period,
    startDate,
    endDate,
  ]);

  // Cleanup pending timer on unmount.
  useEffect(() => {
    const timerRef = searchTimeoutRef;

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function cancelPendingSearch() {
    if (searchTimeoutRef.current !== null) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }

    pendingSearchRef.current = false;
  }

  function navigate(values: FilterValues) {
    const normalized = normalizeFilters(values);

    latestValuesRef.current = normalized;

    const url = buildUrl(normalized);

    lastRequestedUrlRef.current = url;

    router.replace(url, {
      scroll: false,
    });
  }

  function updateFilters(
    changes: Partial<FilterValues>
  ) {
    cancelPendingSearch();

    const current = latestValuesRef.current;

    const nextValues: FilterValues = {
      ...current,
      search: searchValueRef.current,
      ...changes,
    };

    if (
      nextValues.period === "custom" &&
      nextValues.startDate &&
      nextValues.endDate &&
      nextValues.startDate > nextValues.endDate
    ) {
      return;
    }

    navigate(nextValues);
  }

  function handleSearchChange(value: string) {
    const nextValue = value.slice(
      0,
      MAX_SEARCH_LENGTH
    );

    setSearchValue(nextValue);
    searchValueRef.current = nextValue;

    cancelPendingSearch();

    pendingSearchRef.current = true;

    searchTimeoutRef.current = setTimeout(() => {
      pendingSearchRef.current = false;
      searchTimeoutRef.current = null;

      navigate({
        ...latestValuesRef.current,
        search: searchValueRef.current,
      });
    }, SEARCH_DEBOUNCE_MS);
  }

  function clearSearch() {
    cancelPendingSearch();

    setSearchValue("");
    searchValueRef.current = "";

    navigate({
      ...latestValuesRef.current,
      search: "",
    });
  }

  function resetFilters() {
    cancelPendingSearch();

    setSearchValue("");
    searchValueRef.current = "";

    navigate({
      search: "",
      type: "all",
      status,
      period: "this_month",
      startDate: "",
      endDate: "",
    });
  }

  function handlePeriodChange(value: string) {
    const nextPeriod = normalizePeriod(value);

    updateFilters({
      period: nextPeriod,
      startDate:
        nextPeriod === "custom"
          ? latestValuesRef.current.startDate
          : "",
      endDate:
        nextPeriod === "custom"
          ? latestValuesRef.current.endDate
          : "",
    });
  }

  function handleStartDateChange(value: string) {
    if (!isValidDate(value)) return;

    const current = latestValuesRef.current;

    if (
      value &&
      current.endDate &&
      value > current.endDate
    ) {
      return;
    }

    updateFilters({
      period: "custom",
      startDate: value,
    });
  }

  function handleEndDateChange(value: string) {
    if (!isValidDate(value)) return;

    const current = latestValuesRef.current;

    if (
      value &&
      current.startDate &&
      value < current.startDate
    ) {
      return;
    }

    updateFilters({
      period: "custom",
      endDate: value,
    });
  }

  const hasActiveFilters =
    searchValue.trim() !== "" ||
    selectedType !== "all" ||
    selectedPeriod !== "this_month";

  return (
    <section
      aria-label="Transaction filters"
      className="min-w-0 rounded-xl border bg-card p-3.5 sm:p-4"
    >
      <div className="flex flex-col gap-3">
        {/* Search and dropdowns */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search */}
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />

            <Input
              type="search"
              value={searchValue}
              onChange={(event) =>
                handleSearchChange(
                  event.target.value
                )
              }
              placeholder="Search item name..."
              aria-label="Search transactions by item name"
              maxLength={MAX_SEARCH_LENGTH}
              className="h-11 min-w-0 pl-9 pr-10 text-base sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />

            {searchValue && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={clearSearch}
                className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X
                  aria-hidden="true"
                  className="size-4"
                />
              </button>
            )}
          </div>

          {/* Dropdown filters */}
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:flex lg:items-center">
            {/* Transaction type */}
            <Select
              value={selectedType}
              onValueChange={(value) =>
                updateFilters({
                  type: normalizeType(value),
                })
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
              onValueChange={
                handlePeriodChange
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
            {/* Start date */}
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
                  handleStartDateChange(
                    event.target.value
                  )
                }
                className="h-11 w-full min-w-0 text-base sm:text-sm"
              />
            </div>

            {/* End date */}
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
                  handleEndDateChange(
                    event.target.value
                  )
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
