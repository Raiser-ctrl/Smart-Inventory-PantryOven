
import { NextRequest, NextResponse } from "next/server";

import { verifyApiAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

import {
  getInventoryAnalytics,
  type AnalyticsPeriod,
} from "@/lib/inventory-analytics";

export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
};

// Return a consistent API error response.
function errorResponse(message: string, status: number) {
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

// Validate the requested analytics period.
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

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin permission.
    const auth = await verifyApiAdmin();

    if (!auth.authorized) {
      return errorResponse(auth.message, auth.status);
    }

    // Read and validate the analytics period.
    const period = parsePeriod(
      request.nextUrl.searchParams.get("period")
    );

    if (period === null) {
      return errorResponse(
        "Periode tidak valid. Gunakan 7 atau 30 hari.",
        400
      );
    }

    // Fetch analytics and inventory concurrently.
    const [analytics, inventoryResult] = await Promise.all([
      getInventoryAnalytics(period),

      supabaseAdmin
        .from("inventory_current_stock")
        .select(
          "id, name, unit, current_stock, minimum_stock"
        ),
    ]);

    // Validate inventory query result.
    if (inventoryResult.error) {
      console.error(
        "Analytics inventory query error:",
        inventoryResult.error
      );

      throw new Error(
        "Gagal mengambil data stok inventory."
      );
    }

    // Prepare low-stock alerts.
    const lowStock = (inventoryResult.data ?? [])
      .filter(
        (item) =>
          Number(item.current_stock) <=
          Number(item.minimum_stock)
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        current_stock: Number(item.current_stock),
        minimum_stock: Number(item.minimum_stock),
      }))
      .sort((a, b) => {
        const shortageA =
          a.current_stock - a.minimum_stock;

        const shortageB =
          b.current_stock - b.minimum_stock;

        return shortageA - shortageB;
      });

    // Return complete analytics data.
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

          // Daily transaction analytics.
          totals: analytics.totals,
          daily: analytics.daily,

          // Inventory stock monitoring.
          lowStock,
          lowStockCount: lowStock.length,

          // Advanced inventory insights.
          topUsedMaterials: analytics.topUsedMaterials,
          wasteMonitoring: analytics.wasteMonitoring,
        },
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error("Inventory analytics API error:", error);

    return errorResponse(
      "Gagal mengambil data analytics.",
      500
    );
  }
}
