
"use client";

import Link from "next/link";

import {
  Download,
  FileSpreadsheet,
  FileText,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ArchiveStatus = "active" | "archived" | "all";

type Props = {
  search: string;
  type: string;
  status: ArchiveStatus;
  startDate: string;
  endDate: string;
};

export default function TransactionExport({
  search,
  type,
  status,
  startDate,
  endDate,
}: Props) {
  function buildExportUrl(format: "csv" | "xlsx") {
    const params = new URLSearchParams();

    params.set("format", format);
    params.set("status", status);

    const normalizedSearch = search.trim().slice(0, 100);

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

  const hasInvalidRange = Boolean(
    startDate &&
    endDate &&
    startDate > endDate
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={hasInvalidRange}
          aria-label="Export transaction history"
          title={
            hasInvalidRange
              ? "Invalid date range"
              : "Export transaction history"
          }
          className="min-h-11 w-full gap-2 sm:w-auto"
        >
          <Download
            aria-hidden="true"
            className="size-4 shrink-0"
          />
          Export
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-48 max-w-[calc(100vw-2rem)] p-1"
      >
        <DropdownMenuItem
          asChild
          className="min-h-11 cursor-pointer gap-2 px-3"
        >
          <Link
            href={buildExportUrl("csv")}
            prefetch={false}
          >
            <FileText
              aria-hidden="true"
              className="size-4 shrink-0"
            />
            Export CSV
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="min-h-11 cursor-pointer gap-2 px-3"
        >
          <Link
            href={buildExportUrl("xlsx")}
            prefetch={false}
          >
            <FileSpreadsheet
              aria-hidden="true"
              className="size-4 shrink-0"
            />
            Export Excel
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
