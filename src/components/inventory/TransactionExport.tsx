
"use client";

import { useState } from "react";

import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ArchiveStatus = "active" | "archived" | "all";

type ExportFormat = "csv" | "xlsx";

type Props = {
  search: string;
  type: string;
  status: ArchiveStatus;
  startDate: string;
  endDate: string;
};

const MAX_SEARCH_LENGTH = 100;

const VALID_TRANSACTION_TYPES = [
  "all",
  "stock_in",
  "stock_out",
  "usage",
  "waste",
] as const;

function isValidDate(value: string) {
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

export default function TransactionExport({
  search,
  type,
  status,
  startDate,
  endDate,
}: Props) {
  const [exporting, setExporting] =
    useState<ExportFormat | null>(null);

  const hasInvalidRange =
    !isValidDate(startDate) ||
    !isValidDate(endDate) ||
    Boolean(
      startDate &&
      endDate &&
      startDate > endDate
    );

  const hasInvalidType =
    !VALID_TRANSACTION_TYPES.some(
      (value) => value === type
    );

  const exportDisabled =
    hasInvalidRange ||
    hasInvalidType ||
    exporting !== null;

  function buildExportUrl(format: ExportFormat) {
    const params = new URLSearchParams();

    params.set("format", format);
    params.set("status", status);

    const normalizedSearch = search
      .trim()
      .slice(0, MAX_SEARCH_LENGTH);

    if (normalizedSearch) {
      params.set("search", normalizedSearch);
    }

    if (type !== "all") {
      params.set("type", type);
    }

    if (startDate) {
      params.set("startDate", startDate);
    }

    if (endDate) {
      params.set("endDate", endDate);
    }

    return `/api/v1/transactions/export?${params.toString()}`;
  }

  function handleExport(format: ExportFormat) {
    if (exportDisabled) return;

    setExporting(format);

    // Native navigation lets the browser handle
    // Content-Disposition: attachment.
    window.location.assign(buildExportUrl(format));

    // No reliable browser event indicates that a
    // download has completed. Avoid claiming success.
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={exportDisabled}
          aria-label="Export transaction history"
          title={
            hasInvalidRange
              ? "Invalid date range"
              : hasInvalidType
                ? "Invalid transaction type"
                : "Export transaction history"
          }
          className="min-h-11 w-full gap-2 sm:w-auto"
        >
          {exporting ? (
            <Loader2
              aria-hidden="true"
              className="size-4 shrink-0 animate-spin"
            />
          ) : (
            <Download
              aria-hidden="true"
              className="size-4 shrink-0"
            />
          )}

          {exporting ? "Exporting..." : "Export"}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-48 max-w-[calc(100vw-2rem)] p-1"
      >
        <DropdownMenuItem
          disabled={exportDisabled}
          onSelect={() => handleExport("csv")}
          className="min-h-11 cursor-pointer gap-2 px-3"
        >
          <FileText
            aria-hidden="true"
            className="size-4 shrink-0"
          />
          Export CSV
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={exportDisabled}
          onSelect={() => handleExport("xlsx")}
          className="min-h-11 cursor-pointer gap-2 px-3"
        >
          <FileSpreadsheet
            aria-hidden="true"
            className="size-4 shrink-0"
          />
          Export Excel
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
