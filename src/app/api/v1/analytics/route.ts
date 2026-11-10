
import { NextRequest, NextResponse } from "next/server";

import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

import {
  getInventoryAnalytics,
  type AnalyticsPeriod,
} from "@/lib/inventory-analytics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

type LowStockItem = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
};

// Return consistent API errors
function errorResponse(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: responseHeaders,
    }
  );
}

// Validate analytics period
function parsePeriod(
  value: string | null
): AnalyticsPeriod | null {
  if (value === null || value === "7") {
    return 7;
  }

  if (value === "30") {
    return 30;
  }

  return null;
}

// Process low-stock inventory alerts
function buildLowStock(
  items: Array<{
    id: string;
    name: string;
    unit: string;
    current_stock: number | null;
    minimum_stock: number | null;
  }>
): LowStockItem[] {
  const lowStock: LowStockItem[] = [];

  for (const item of items) {
    // Reject missing stock values
    if (
      item.current_stock === null ||
      item.minimum_stock === null
    ) {
      throw new Error(
        "Ditemukan nilai stok inventory kosong."
      );
    }

    const currentStock = Number(
      item.current_stock
    );

    const minimumStock = Number(
      item.minimum_stock
    );

    // Reject invalid stock values
    if (
      !Number.isFinite(currentStock) ||
      !Number.isFinite(minimumStock) ||
      currentStock < 0 ||
      minimumStock < 0
    ) {
      throw new Error(
        "Ditemukan nilai stok inventory tidak valid."
      );
    }

    // Collect items at or below minimum stock
    if (currentStock <= minimumStock) {
      lowStock.push({
        id: item.id,
        name: item.name,
        unit: item.unit,
        current_stock: currentStock,
        minimum_stock: minimumStock,
      });
    }
  }

  // Prioritize the largest stock shortages
  lowStock.sort((a, b) => {
    const shortageA =
      a.current_stock - a.minimum_stock;

    const shortageB =
      b.current_stock - b.minimum_stock;

    return (
      shortageA - shortageB ||
      a.name.localeCompare(b.name, "id")
    );
  });

  return lowStock;
}

// GET analytics for active Admin and Staff
export async function GET(
  request: NextRequest
) {
  try {
    // Verify active Admin or Staff
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return errorResponse(
        auth.message,
        auth.status
      );
    }

    // Validate requested analytics period
    const period = parsePeriod(
      request.nextUrl.searchParams.get(
        "period"
      )
    );

    if (period === null) {
      return errorResponse(
        "Periode tidak valid. Gunakan 7 atau 30 hari.",
        400
      );
    }

    // Fetch analytics and active inventory concurrently
    const [analytics, inventoryResult] =
      await Promise.all([
        getInventoryAnalytics(period),

        supabaseAdmin
          .from("inventory_current_stock")
          .select(
            "id, name, unit, current_stock, minimum_stock"
          )
          .is("archived_at", null),
      ]);

    // Check inventory query result
    if (inventoryResult.error) {
      console.error(
        "Analytics inventory query error:",
        inventoryResult.error
      );

      throw new Error(
        "Gagal mengambil data stok inventory."
      );
    }

    // Build low-stock alerts
    const lowStock = buildLowStock(
      inventoryResult.data ?? []
    );

    // Return analytics response
    return NextResponse.json(
      {
        success: true,
        data: {
          period: {
            days: analytics.period,
            timezone: analytics.timezone,
            startDate: analytics.startDate,
            endDate: analytics.endDate,
          },

          totals: analytics.totals,

          daily: analytics.daily,

          lowStock,
          lowStockCount: lowStock.length,

          topUsedMaterials:
            analytics.topUsedMaterials,

          wasteMonitoring:
            analytics.wasteMonitoring,
        },
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error(
      "Inventory analytics API error:",
      error
    );

    return errorResponse(
      "Gagal mengambil data analytics.",
      500
    );
  }
}
