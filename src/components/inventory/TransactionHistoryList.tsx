
"use client";

import { useState } from "react";

import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type TransactionHistoryRow = {
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

type Props = {
  history: TransactionHistoryRow[];
  status: "active" | "archived" | "all";
  hasInvalidRange: boolean;
};

const typeLabels: Record<string, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  usage: "Usage",
  waste: "Waste",
};

const typeStyles: Record<string, string> = {
  stock_in:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  stock_out:
    "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  usage:
    "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  waste:
    "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-400",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const quantityFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

function TransactionBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="outline"
      className={`max-w-full shrink-0 whitespace-nowrap ${
        typeStyles[type] ??
        "border-border bg-muted text-foreground"
      }`}
    >
      {typeLabels[type] ?? type}
    </Badge>
  );
}

function QuantityDisplay({
  transaction,
}: {
  transaction: TransactionHistoryRow;
}) {
  const incoming =
    transaction.transaction_type === "stock_in";

  return (
    <span
      className={`font-semibold tabular-nums ${
        incoming
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-orange-600 dark:text-orange-400"
      }`}
    >
      {incoming ? "+" : "−"}
      {quantityFormatter.format(
        Math.abs(transaction.quantity)
      )}{" "}
      {transaction.unit}
    </span>
  );
}

function TransactionNotes({
  notes,
}: {
  notes: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!notes?.trim()) {
    return (
      <span className="text-muted-foreground">
        —
      </span>
    );
  }

  const isLong = notes.length > 90;

  return (
    <div className="min-w-0 max-w-full">
      <p
        className={
          expanded
            ? "whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            : "line-clamp-2 break-words [overflow-wrap:anywhere]"
        }
        title={expanded ? undefined : notes}
      >
        {notes}
      </p>

      {isLong && (
        <button
          type="button"
          onClick={() =>
            setExpanded((previous) => !previous)
          }
          aria-expanded={expanded}
          className="mt-1 inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? (
            <>
              Show less
              <ChevronUp
                aria-hidden="true"
                className="size-3.5"
              />
            </>
          ) : (
            <>
              Read more
              <ChevronDown
                aria-hidden="true"
                className="size-3.5"
              />
            </>
          )}
        </button>
      )}
    </div>
  );
}

function EmptyState({
  status,
  hasInvalidRange,
}: {
  status: Props["status"];
  hasInvalidRange: boolean;
}) {
  const message = hasInvalidRange
    ? "Tanggal mulai tidak boleh setelah tanggal akhir."
    : status === "archived"
      ? "Belum ada transaksi dari barang yang diarsipkan."
      : "Tidak ada transaksi yang cocok dengan filter.";

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <Package
          aria-hidden="true"
          className="size-5 text-muted-foreground"
        />
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium">
          No transactions found
        </p>

        <p className="max-w-sm text-sm text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}

export default function TransactionHistoryList({
  history,
  status,
  hasInvalidRange,
}: Props) {
  if (history.length === 0) {
    return (
      <EmptyState
        status={status}
        hasInvalidRange={hasInvalidRange}
      />
    );
  }

  return (
    <>
      {/* Desktop / tablet table */}
      <div className="hidden min-w-0 max-w-full overflow-x-auto md:block">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[24%]">
                Item
              </TableHead>

              <TableHead>Type</TableHead>

              <TableHead>Quantity</TableHead>

              <TableHead className="w-[25%]">
                Notes
              </TableHead>

              <TableHead className="whitespace-nowrap">
                Date
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {history.map((transaction) => (
              <TableRow
                key={transaction.id}
                className="align-top"
              >
                <TableCell>
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/30">
                      <Package
                        aria-hidden="true"
                        className="size-4 text-muted-foreground"
                      />
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className="break-words font-medium [overflow-wrap:anywhere]">
                        {transaction.itemName}
                      </p>

                      {transaction.itemArchivedAt &&
                        status === "all" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-muted-foreground"
                          >
                            Archived
                          </Badge>
                        )}
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <TransactionBadge
                    type={transaction.transaction_type}
                  />
                </TableCell>

                <TableCell>
                  <QuantityDisplay
                    transaction={transaction}
                  />
                </TableCell>

                <TableCell className="max-w-[260px] text-sm text-muted-foreground">
                  <TransactionNotes
                    notes={transaction.notes}
                  />
                </TableCell>

                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {dateFormatter.format(
                    new Date(transaction.created_at)
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile transaction cards */}
      <div className="space-y-3 md:hidden">
        {history.map((transaction) => (
          <article
            key={transaction.id}
            className="min-w-0 rounded-xl border bg-card p-3.5"
          >
            {/* Item and transaction type */}
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Package
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold [overflow-wrap:anywhere]">
                    {transaction.itemName}
                  </p>

                  <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    <CalendarDays
                      aria-hidden="true"
                      className="size-3 shrink-0"
                    />

                    <span className="break-words">
                      {dateFormatter.format(
                        new Date(transaction.created_at)
                      )}
                    </span>
                  </p>
                </div>
              </div>

              <TransactionBadge
                type={transaction.transaction_type}
              />
            </div>

            {/* Archive status */}
            {transaction.itemArchivedAt &&
              status === "all" && (
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className="text-[10px] text-muted-foreground"
                  >
                    Archived
                  </Badge>
                </div>
              )}

            {/* Quantity */}
            <div className="mt-3 flex min-w-0 items-start justify-between gap-3 border-t pt-3">
              <span className="shrink-0 text-xs text-muted-foreground">
                Quantity
              </span>

              <div className="min-w-0 break-words text-right text-sm [overflow-wrap:anywhere]">
                <QuantityDisplay
                  transaction={transaction}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mt-3 min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">
                Notes
              </p>

              <div className="min-w-0 text-sm">
                <TransactionNotes
                  notes={transaction.notes}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
