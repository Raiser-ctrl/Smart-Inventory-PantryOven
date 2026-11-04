
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

const VALID_CATEGORIES = [
  "raw_material",
  "finished_product",
] as const;

const VALID_UNITS = [
  "kg",
  "pcs",
  "liter",
  "gram",
] as const;

const MAX_STOCK = 1_000_000_000;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ItemInput = {
  name: string;
  category: (typeof VALID_CATEGORIES)[number];
  unit: (typeof VALID_UNITS)[number];
  minimum_stock: number;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers }
  );
}

// ==========================================
// AUTHORIZATION
// ==========================================

async function verifyAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonError(
      "Unauthorized. Silakan login terlebih dahulu.",
      401
    );
  }

  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId) {
    console.error("ADMIN_USER_ID belum dikonfigurasi.");

    return jsonError(
      "Konfigurasi server belum lengkap.",
      500
    );
  }

  if (user.id !== adminUserId) {
    return jsonError(
      "Forbidden. Hanya admin yang dapat mengubah data.",
      403
    );
  }

  return null;
}

// ==========================================
// REQUEST SECURITY
// ==========================================

function verifyOrigin(request: NextRequest) {
  const configuredOrigin =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "");

  if (!configuredOrigin) {
    console.error("APP_ORIGIN belum dikonfigurasi.");

    return jsonError(
      "APP_ORIGIN belum dikonfigurasi.",
      500
    );
  }

  let allowedOrigin: string;

  try {
    const parsed = new URL(configuredOrigin);

    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      parsed.origin === "null" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("Invalid APP_ORIGIN");
    }

    allowedOrigin = parsed.origin;
  } catch {
    console.error("APP_ORIGIN tidak valid.");

    return jsonError(
      "Konfigurasi APP_ORIGIN tidak valid.",
      500
    );
  }

  if (request.headers.get("origin") !== allowedOrigin) {
    return jsonError(
      "Origin request tidak diizinkan.",
      403
    );
  }

  return null;
}

function verifyJsonContentType(request: NextRequest) {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (!/^application\/json(?:\s*;|$)/i.test(contentType)) {
    return jsonError(
      "Content-Type harus application/json.",
      415
    );
  }

  return null;
}

async function verifyMutation(request: NextRequest) {
  const authError = await verifyAdmin();

  if (authError) return authError;

  const originError = verifyOrigin(request);

  if (originError) return originError;

  return null;
}

// ==========================================
// INPUT VALIDATION
// ==========================================

function validateItemInput(
  body: unknown
):
  | { valid: true; data: ItemInput }
  | { valid: false; message: string } {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {
    return {
      valid: false,
      message: "Data barang tidak valid.",
    };
  }

  const input = body as Record<string, unknown>;

  const allowedFields = [
    "name",
    "category",
    "unit",
    "minimum_stock",
  ];

  if (
    Object.keys(input).some(
      (key) => !allowedFields.includes(key)
    )
  ) {
    return {
      valid: false,
      message: "Terdapat field yang tidak diizinkan.",
    };
  }

  const name =
    typeof input.name === "string"
      ? input.name.trim()
      : "";

  const category = input.category;
  const unit = input.unit;
  const minimumStock = input.minimum_stock;

  if (name.length === 0 || name.length > 150) {
    return {
      valid: false,
      message:
        "Nama barang wajib diisi dan maksimal 150 karakter.",
    };
  }

  if (
    typeof category !== "string" ||
    !VALID_CATEGORIES.some(
      (value) => value === category
    )
  ) {
    return {
      valid: false,
      message: "Kategori barang tidak valid.",
    };
  }

  if (
    typeof unit !== "string" ||
    !VALID_UNITS.some(
      (value) => value === unit
    )
  ) {
    return {
      valid: false,
      message: "Satuan barang tidak valid.",
    };
  }

  if (
    typeof minimumStock !== "number" ||
    !Number.isFinite(minimumStock) ||
    minimumStock < 0 ||
    minimumStock > MAX_STOCK
  ) {
    return {
      valid: false,
      message:
        "Stok minimum harus berupa angka antara 0 dan 1.000.000.000.",
    };
  }

  return {
    valid: true,
    data: {
      name,
      category: category as ItemInput["category"],
      unit: unit as ItemInput["unit"],
      minimum_stock: minimumStock,
    },
  };
}

// ==========================================
// TRANSACTION HISTORY
// ==========================================

async function hasTransactions(itemId: string) {
  const { data, error } = await supabaseAdmin
    .from("stock_transactions")
    .select("id")
    .eq("item_id", itemId)
    .limit(1);

  if (error) throw error;

  return (data?.length ?? 0) > 0;
}

// ==========================================
// PATCH /api/v1/items/[id]
// ==========================================

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const securityError = await verifyMutation(request);

    if (securityError) return securityError;

    const { id } = await context.params;

    if (!uuidPattern.test(id)) {
      return jsonError("ID barang tidak valid.", 400);
    }

    const contentTypeError =
      verifyJsonContentType(request);

    if (contentTypeError) return contentTypeError;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Format JSON tidak valid.", 400);
    }

    const validation = validateItemInput(body);

    if (!validation.valid) {
      return jsonError(validation.message, 400);
    }

    const {
      name,
      category,
      unit,
      minimum_stock,
    } = validation.data;

    // Atomic update via PostgreSQL RPC.
    // The RPC locks the item row and checks transaction history.
    const { data, error } = await supabaseAdmin.rpc(
      "update_inventory_item",
      {
        p_item_id: id,
        p_name: name,
        p_category: category,
        p_unit: unit,
        p_minimum_stock: minimum_stock,
      }
    );

    if (error) {
      const errorMessage = error.message;

      if (errorMessage.includes("ITEM_NOT_FOUND")) {
        return jsonError("Barang tidak ditemukan.", 404);
      }

      if (errorMessage.includes("ITEM_ARCHIVED")) {
        return jsonError(
          "Barang sudah diarsipkan. Aktifkan kembali sebelum mengedit barang.",
          409
        );
      }

      if (
        errorMessage.includes(
          "UNIT_CHANGE_HAS_TRANSACTIONS"
        )
      ) {
        return jsonError(
          "Satuan barang tidak dapat diubah karena sudah memiliki riwayat transaksi.",
          409
        );
      }

      if (errorMessage.includes("INVALID_ITEM_INPUT")) {
        return jsonError(
          "Data barang tidak valid.",
          400
        );
      }

      console.error(
        "PATCH item RPC error:",
        error.message
      );

      return jsonError(
        "Gagal memperbarui barang.",
        500
      );
    }

    if (!data) {
      return jsonError(
        "Barang tidak ditemukan.",
        404
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil diperbarui.",
        data: {
          id: data.id,
          name: data.name,
          category: data.category,
          unit: data.unit,
          initial_stock: data.initial_stock,
          minimum_stock: data.minimum_stock,
        },
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("PATCH items error:", error);

    return jsonError("Internal Server Error", 500);
  }
}

// ==========================================
// DELETE /api/v1/items/[id]
// ==========================================

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const securityError = await verifyMutation(request);

    if (securityError) return securityError;

    const { id } = await context.params;

    if (!uuidPattern.test(id)) {
      return jsonError("ID barang tidak valid.", 400);
    }

    const { data: existing, error: lookupError } =
      await supabaseAdmin
        .from("items")
        .select("id, archived_at")
        .eq("id", id)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (!existing) {
      return jsonError("Barang tidak ditemukan.", 404);
    }

    if (existing.archived_at !== null) {
      return jsonError(
        "Barang sudah diarsipkan. Aktifkan kembali sebelum menghapus barang.",
        409
      );
    }

    if (await hasTransactions(id)) {
      return jsonError(
        "Barang tidak dapat dihapus karena memiliki riwayat transaksi.",
        409
      );
    }

    const { data, error } = await supabaseAdmin
      .from("items")
      .delete()
      .eq("id", id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      if (error.code === "23503") {
        return jsonError(
          "Barang tidak dapat dihapus karena masih digunakan oleh data lain.",
          409
        );
      }

      console.error(
        "DELETE item error:",
        error.message
      );

      return jsonError(
        "Gagal menghapus barang.",
        500
      );
    }

    if (!data) {
      return jsonError(
        "Status barang sudah berubah. Silakan muat ulang.",
        409
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil dihapus.",
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("DELETE items error:", error);

    return jsonError("Internal Server Error", 500);
  }
}
