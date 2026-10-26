
import "server-only";

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

export async function getInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabaseAdmin
    .from("inventory_current_stock")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Inventory database error:", error.message);
    throw new Error("Gagal mengambil data inventory");
  }

  return (data ?? []) as InventoryItem[];
}
