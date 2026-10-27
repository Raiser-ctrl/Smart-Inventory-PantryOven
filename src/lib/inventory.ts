
import "server-only";

import { performance } from "node:perf_hooks";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type InventoryItem = {
  id: string;
  name: string;
  category: "raw_material" | "finished_product";
  unit: string;
  initial_stock: number;
  minimum_stock: number;
  current_stock: number;
};

const shouldMeasurePerformance =
  process.env.NODE_ENV === "development" ||
  process.env.PERF_DEBUG === "true";

// Fetch current inventory stock from Supabase.
export async function getInventoryItems(): Promise<InventoryItem[]> {
  const startedAt = performance.now();

  const { data, error } = await supabaseAdmin
    .from("inventory_current_stock")
    .select(
      "id, name, category, unit, initial_stock, minimum_stock, current_stock"
    )
    .order("name", { ascending: true });

  if (shouldMeasurePerformance) {
    console.info(
      `[Inventory DB] Query: ${Math.round(
        performance.now() - startedAt
      )}ms`
    );
  }

  if (error) {
    console.error("Inventory database error:", {
      code: error.code,
      message: error.message,
      details: error.details,
    });

    throw new Error("Gagal mengambil data inventory.");
  }

  return (data ?? []) as InventoryItem[];
}
