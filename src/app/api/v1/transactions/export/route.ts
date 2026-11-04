
import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";

import { requireAdmin } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

import {
  normalizeDate,
  jakartaDateBoundary,
} from "@/lib/transaction-period";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_TYPES = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
] as const;

type ArchiveStatus = "active" | "archived" | "all";

const BATCH_SIZE = 500;
const MAX_EXPORT_ROWS = 50_000;
const MAX_SEARCH_LENGTH = 100;


type Transaction = {
  id: string;
  item_id: string;
  transaction_type: string;
  quantity: number;
  notes: string | null;
  created_at: string;
};

type ExportRow = {
  date: string;
  item: string;
  type: string;
  quantity: number;
  unit: string;
  notes: string;
};

type ItemDetail = {
  name: string;
  unit: string;
};

const typeLabels: Record<string, string> = {
  stock_in: "Stock In",
  stock_out: "Stock Out",
  usage: "Usage",
  waste: "Waste",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});

const reportDateFormatter = new Intl.DateTimeFormat(
  "id-ID",
  {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }
);

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: responseHeaders,
    }
  );
}

// ==========================================
// INPUT / EXPORT SECURITY
// ==========================================

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function escapeCsv(value: unknown) {
  let text = String(value ?? "");

  // Prevent spreadsheet formula execution when CSV
  // is opened by Excel or other spreadsheet software.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

function escapeExcelText(value: string) {
  if (/^[\s\uFEFF]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }

  return value;
}

function createCsv(rows: ExportRow[]) {
  const columns = [
    "Date",
    "Item",
    "Type",
    "Quantity",
    "Unit",
    "Notes",
  ];

  const lines = [
    columns.map(escapeCsv).join(","),
    ...rows.map((row) =>
      [
        row.date,
        row.item,
        row.type,
        row.quantity,
        row.unit,
        row.notes,
      ]
        .map(escapeCsv)
        .join(",")
    ),
  ];

  return "\uFEFF" + lines.join("\r\n");
}

function formatPeriod(
  startDate: string,
  endDate: string
) {
  if (!startDate && !endDate) {
    return "All Time";
  }

  const format = (value: string) =>
    reportDateFormatter.format(
      new Date(`${value}T12:00:00+07:00`)
    );

  if (startDate && endDate) {
    return `${format(startDate)} - ${format(endDate)}`;
  }

  if (startDate) {
    return `From ${format(startDate)}`;
  }

  return `Until ${format(endDate)}`;
}

// ==========================================
// EXCEL REPORT
// ==========================================

function createExcelReport(
  rows: ExportRow[],
  startDate: string,
  endDate: string,
  type: string,
  status: ArchiveStatus,
  search: string
) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "PantryOven";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(
    "Stock Movements",
    {
      properties: {
        defaultRowHeight: 22,
      },
      pageSetup: {
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    }
  );

  const COLORS = {
    text: "FF25313D",
    muted: "FF64748B",
    header: "FFE8EEF2",
    alternate: "FFF7F9FB",
    border: "FFE2E8F0",
    green: "FF15803D",
    red: "FFB91C1C",
  };

  worksheet.columns = [
    { key: "date", width: 26 },
    { key: "item", width: 30 },
    { key: "type", width: 18 },
    { key: "quantity", width: 15 },
    { key: "unit", width: 12 },
    { key: "notes", width: 44 },
  ];

  // Report title
  worksheet.mergeCells("A1:F1");

  const titleCell = worksheet.getCell("A1");
  titleCell.value =
    "PantryOven - Stock Movement Report";

  titleCell.font = {
    name: "Calibri",
    size: 15,
    bold: true,
    color: { argb: COLORS.text },
  };

  titleCell.alignment = {
    vertical: "middle",
  };

  worksheet.getRow(1).height = 32;

  // Period
  worksheet.mergeCells("A2:F2");

  const periodCell = worksheet.getCell("A2");
  periodCell.value =
    `Period: ${formatPeriod(startDate, endDate)}`;

  periodCell.font = {
    name: "Calibri",
    size: 10,
    color: { argb: COLORS.muted },
  };

  worksheet.getRow(2).height = 22;

  // Filter information
  worksheet.mergeCells("A3:F3");

  const selectedType =
    type === "all"
      ? "All Transactions"
      : typeLabels[type] ?? type;

  const selectedStatus =
    status === "active"
      ? "Active"
      : status === "archived"
        ? "Archived"
        : "All";

  const filterCell = worksheet.getCell("A3");

  filterCell.value =
    `Status: ${selectedStatus}   |   ` +
    `Type: ${selectedType}   |   ` +
    `Item: ${escapeExcelText(search || "All Items")}   |   ` +
    `Total: ${rows.length} transactions`;

  filterCell.font = {
    name: "Calibri",
    size: 10,
    color: { argb: COLORS.muted },
  };

  worksheet.getRow(3).height = 22;
  worksheet.getRow(4).height = 12;

  // Table header
  const columns = [
    "Date",
    "Item",
    "Type",
    "Quantity",
    "Unit",
    "Notes",
  ];

  const headerRow = worksheet.getRow(5);

  columns.forEach((header, index) => {
    const cell = headerRow.getCell(index + 1);

    cell.value = header;

    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: COLORS.text },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.header },
    };

    cell.alignment = {
      vertical: "middle",
      indent: index === 3 ? 0 : 1,
    };

    cell.border = {
      bottom: {
        style: "thin",
        color: { argb: COLORS.border },
      },
    };
  });

  headerRow.height = 28;

  // Transaction rows
  rows.forEach((row, index) => {
    const excelRow = worksheet.addRow({
      date: escapeExcelText(row.date),
      item: escapeExcelText(row.item),
      type: escapeExcelText(row.type),
      quantity: row.quantity,
      unit: escapeExcelText(row.unit),
      notes: escapeExcelText(row.notes),
    });

    const estimatedLines = row.notes
      .split(/\r?\n/)
      .reduce(
        (total, line) =>
          total + Math.max(
            1,
            Math.ceil(line.length / 42)
          ),
        0
      );

    excelRow.height = Math.min(
      72,
      Math.max(26, estimatedLines * 16 + 8)
    );

    excelRow.eachCell(
      { includeEmpty: true },
      (cell, colNumber) => {
        cell.font = {
          name: "Calibri",
          size: 11,
          color: { argb: COLORS.text },
        };

        cell.alignment = {
          vertical: "middle",
          indent: colNumber === 4 ? 0 : 1,
          wrapText: colNumber === 6,
        };

        if (index % 2 === 1) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: COLORS.alternate,
            },
          };
        }

        cell.border = {
          bottom: {
            style: "hair",
            color: { argb: COLORS.border },
          },
        };
      }
    );

    const movementColor =
      row.type === "Stock In"
        ? COLORS.green
        : COLORS.red;

    excelRow.getCell(3).font = {
      name: "Calibri",
      size: 11,
      color: { argb: movementColor },
    };

    const quantityCell = excelRow.getCell(4);

    quantityCell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: movementColor },
    };

    quantityCell.alignment = {
      horizontal: "right",
      vertical: "middle",
    };

    quantityCell.numFmt =
      '+#,##0.##;-#,##0.##;0';
  });

  // Empty state
  if (rows.length === 0) {
    worksheet.mergeCells("A6:F6");

    const emptyCell = worksheet.getCell("A6");

    emptyCell.value =
      "No transactions found for the selected filters.";

    emptyCell.font = {
      name: "Calibri",
      size: 11,
      italic: true,
      color: { argb: COLORS.muted },
    };

    emptyCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    worksheet.getRow(6).height = 30;
  }

  // Worksheet settings
  const lastRow = Math.max(
    6,
    5 + rows.length
  );

  worksheet.views = [
    { showGridLines: false },
  ];

  worksheet.autoFilter = {
    from: "A5",
    to: `F${lastRow}`,
  };

  worksheet.pageSetup.printArea =
    `A1:F${lastRow}`;

  worksheet.pageSetup.margins = {
    left: 0.3,
    right: 0.3,
    top: 0.5,
    bottom: 0.5,
    header: 0.2,
    footer: 0.2,
  };

  worksheet.headerFooter.oddFooter =
    "&LPantryOven&RPage &P of &N";

  return workbook;
}

// ==========================================
// EXPORT API
// ==========================================

export async function GET(request: NextRequest) {
  await requireAdmin();

  try {
    const params = request.nextUrl.searchParams;

    const format = params.get("format") ?? "csv";
    const rawSearch = params.get("search") ?? "";
    const search = rawSearch.trim();

    const type = params.get("type") ?? "all";
    const rawStatus = params.get("status") ?? "active";

    const rawStartDate =
      params.get("startDate") ?? "";

    const rawEndDate =
      params.get("endDate") ?? "";

    const startDate = normalizeDate(rawStartDate);
    const endDate = normalizeDate(rawEndDate);

    // ======================================
    // PARAMETER VALIDATION
    // ======================================

    if (format !== "csv" && format !== "xlsx") {
      return jsonError(
        "Invalid export format.",
        400
      );
    }

    if (search.length > MAX_SEARCH_LENGTH) {
      return jsonError(
        "Search cannot exceed 100 characters.",
        400
      );
    }

    if (
      type !== "all" &&
      !VALID_TYPES.includes(
        type as (typeof VALID_TYPES)[number]
      )
    ) {
      return jsonError(
        "Invalid transaction type.",
        400
      );
    }

    if (
      rawStatus !== "active" &&
      rawStatus !== "archived" &&
      rawStatus !== "all"
    ) {
      return jsonError(
        "Invalid archive status.",
        400
      );
    }

    const status: ArchiveStatus = rawStatus;

    if (
      (rawStartDate && !startDate) ||
      (rawEndDate && !endDate)
    ) {
      return jsonError(
        "Invalid date format. Use YYYY-MM-DD.",
        400
      );
    }

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      return jsonError(
        "Start date cannot be after end date.",
        400
      );
    }

    // ======================================
    // QUERY TRANSACTIONS
    // ======================================

    const transactions: Transaction[] = [];

    // Stable upper boundary for newly inserted
    // transactions during export.
    const exportCutoff = new Date().toISOString();

    let cursorCreatedAt: string | null = null;
    let cursorId: string | null = null;

    while (transactions.length <= MAX_EXPORT_ROWS) {
      let query = supabaseAdmin
        .from("stock_transactions")
        .select(`
          id,
          item_id,
          transaction_type,
          quantity,
          notes,
          created_at,
          item:items!inner (
            id,
            name,
            unit,
            archived_at
          )
        `)
        .lte("created_at", exportCutoff);

      if (type !== "all") {
        query = query.eq(
          "transaction_type",
          type
        );
      }

      if (search) {
        query = query.ilike(
          "item.name",
          `%${escapeLike(search)}%`
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

      if (cursorCreatedAt && cursorId) {
        query = query.or(
          `created_at.lt.${cursorCreatedAt},` +
          `and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`
        );
      }

      const remaining =
        MAX_EXPORT_ROWS + 1 - transactions.length;

      const limit = Math.min(
        BATCH_SIZE,
        remaining
      );

      const { data, error } = await query
        .order("created_at", {
          ascending: false,
        })
        .order("id", {
          ascending: false,
        })
        .limit(limit);

      if (error) {
        console.error(
          "Export transaction query error:",
          error.message
        );

        return jsonError(
          "Failed to fetch transactions.",
          500
        );
      }

      const batch = data ?? [];

      for (const row of batch) {
        transactions.push({
          id: row.id,
          item_id: row.item_id,
          transaction_type: row.transaction_type,
          quantity: Number(row.quantity),
          notes: row.notes,
          created_at: row.created_at,
        });
      }

      if (
        transactions.length > MAX_EXPORT_ROWS ||
        batch.length < limit
      ) {
        break;
      }

      const last = batch[batch.length - 1];

      cursorCreatedAt = last.created_at;
      cursorId = last.id;
    }

    if (transactions.length > MAX_EXPORT_ROWS) {
      return jsonError(
        "Export limit exceeded. Narrow your filters and try again.",
        413
      );
    }

    // ======================================
    // FETCH ITEM DETAILS
    // ======================================

    const itemIds = [
      ...new Set(
        transactions.map((row) => row.item_id)
      ),
    ];

    const itemMap = new Map<string, ItemDetail>();

    for (
      let offset = 0;
      offset < itemIds.length;
      offset += BATCH_SIZE
    ) {
      const batchIds = itemIds.slice(
        offset,
        offset + BATCH_SIZE
      );

      const { data, error } = await supabaseAdmin
        .from("items")
        .select("id, name, unit")
        .in("id", batchIds);

      if (error) {
        console.error(
          "Export item query error:",
          error.message
        );

        return jsonError(
          "Failed to fetch item details.",
          500
        );
      }

      for (const item of data ?? []) {
        itemMap.set(item.id, {
          name: item.name,
          unit: item.unit,
        });
      }
    }

    // ======================================
    // PREPARE EXPORT ROWS
    // ======================================

    const rows: ExportRow[] = transactions.map(
      (transaction) => {
        const item = itemMap.get(
          transaction.item_id
        );

        const quantity = Math.abs(
          Number(transaction.quantity)
        );

        return {
          date: dateFormatter.format(
            new Date(transaction.created_at)
          ),
          item: item?.name ?? "Unknown Item",
          type:
            typeLabels[
              transaction.transaction_type
            ] ?? transaction.transaction_type,
          quantity:
            transaction.transaction_type ===
            "stock_in"
              ? quantity
              : -quantity,
          unit: item?.unit ?? "",
          notes: transaction.notes ?? "",
        };
      }
    );

    const filename =
      `pantryoven-stock-report-${
        new Date().toISOString().slice(0, 10)
      }`;

    // ======================================
    // CSV EXPORT
    // ======================================

    if (format === "csv") {
      return new NextResponse(
        createCsv(rows),
        {
          headers: {
            ...responseHeaders,
            "Content-Type":
              "text/csv; charset=utf-8",
            "Content-Disposition":
              `attachment; filename="${filename}.csv"`,
          },
        }
      );
    }

    // ======================================
    // EXCEL EXPORT
    // ======================================

    const workbook = createExcelReport(
      rows,
      startDate,
      endDate,
      type,
      status,
      search
    );

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(
      new Uint8Array(buffer),
      {
        headers: {
          ...responseHeaders,
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            `attachment; filename="${filename}.xlsx"`,
        },
      }
    );
  } catch (error) {
    console.error(
      "Export transactions error:",
      error
    );

    return jsonError(
      "Failed to export transactions.",
      500
    );
  }
}
