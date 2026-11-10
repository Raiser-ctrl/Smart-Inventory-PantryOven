
import { NextRequest, NextResponse } from "next/server";

import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
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

const ALLOWED_UPDATE_FIELDS = new Set([
  "name",
  "category",
  "unit",
  "minimum_stock",
]);

const MAX_STOCK = 1_000_000_000;
const MAX_NAME_LENGTH = 150;

const UUID_REGEX =
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

// Return consistent API errors
function jsonError(message: string, status: number) {
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

// Verify same-origin mutations
function verifyOrigin(request: NextRequest) {
  const configuredOrigin =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "");

  if (!configuredOrigin) {
    console.error("APP_ORIGIN belum dikonfigurasi.");

    return jsonError(
      "Konfigurasi origin server belum lengkap.",
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

// Validate JSON requests
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

// Authorize write operations
async function verifyMutation(request: NextRequest) {
  const auth = await verifyApiStaff();

  if (!auth.authorized) {
    return jsonError(auth.message, auth.status);
  }

  return verifyOrigin(request);
}

// Validate inventory update payload
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

  // Reject unexpected fields
  if (
    Object.keys(input).some(
      (key) => !ALLOWED_UPDATE_FIELDS.has(key)
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

  // Validate item name
  if (
    name.length === 0 ||
    name.length > MAX_NAME_LENGTH
  ) {
    return {
      valid: false,
      message:
        "Nama barang wajib diisi dan maksimal 150 karakter.",
    };
  }

  // Validate category
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

  // Validate unit
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

  // Validate minimum stock
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

// Check whether an item has transaction history
async function hasTransactions(itemId: string) {
  const { data, error } = await supabaseAdmin
    .from("stock_transactions")
    .select("id")
    .eq("item_id", itemId)
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data?.length);
}

// PATCH /api/v1/items/[id]
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Verify account permissions and origin
    const securityError = await verifyMutation(request);

    if (securityError) {
      return securityError;
    }

    const { id } = await context.params;

    if (!UUID_REGEX.test(id)) {
      return jsonError("ID barang tidak valid.", 400);
    }

    const contentTypeError =
      verifyJsonContentType(request);

    if (contentTypeError) {
      return contentTypeError;
    }

    // Parse request body
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Format JSON tidak valid.",
        400
      );
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

    // Update item atomically through PostgreSQL RPC
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
      const message = error.message;

      if (message.includes("ITEM_NOT_FOUND")) {
        return jsonError(
          "Barang tidak ditemukan.",
          404
        );
      }

      if (message.includes("ITEM_ARCHIVED")) {
        return jsonError(
          "Barang sudah diarsipkan. Aktifkan kembali sebelum mengedit barang.",
          409
        );
      }

      if (
        message.includes(
          "UNIT_CHANGE_HAS_TRANSACTIONS"
        )
      ) {
        return jsonError(
          "Satuan barang tidak dapat diubah karena sudah memiliki riwayat transaksi.",
          409
        );
      }

      if (message.includes("INVALID_ITEM_INPUT")) {
        return jsonError(
          "Data barang tidak valid.",
          400
        );
      }

      console.error("PATCH item RPC error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      return jsonError(
        "Gagal memperbarui barang.",
        500
      );
    }

    if (!data || typeof data !== "object") {
      console.error(
        "PATCH item RPC returned invalid data."
      );

      return jsonError(
        "Respons database tidak valid.",
        500
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
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error(
      "PATCH items unexpected error:",
      error
    );

    return jsonError("Internal Server Error", 500);
  }
}

// DELETE /api/v1/items/[id]
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Verify account permissions and origin
    const securityError = await verifyMutation(request);

    if (securityError) {
      return securityError;
    }

    const { id } = await context.params;

    if (!UUID_REGEX.test(id)) {
      return jsonError("ID barang tidak valid.", 400);
    }

    // Read item state
    const { data: existing, error: lookupError } =
      await supabaseAdmin
        .from("items")
        .select("id, archived_at")
        .eq("id", id)
        .maybeSingle();

    if (lookupError) {
      console.error("DELETE item lookup error:", {
        code: lookupError.code,
        message: lookupError.message,
      });

      return jsonError(
        "Gagal memeriksa data barang.",
        500
      );
    }

    if (!existing) {
      return jsonError(
        "Barang tidak ditemukan.",
        404
      );
    }

    if (existing.archived_at !== null) {
      return jsonError(
        "Barang sudah diarsipkan. Aktifkan kembali sebelum menghapus barang.",
        409
      );
    }

    // Prevent deleting items with transaction history
    if (await hasTransactions(id)) {
      return jsonError(
        "Barang tidak dapat dihapus karena memiliki riwayat transaksi.",
        409
      );
    }

    // Delete only active items
    const { data, error } = await supabaseAdmin
      .from("items")
      .delete()
      .eq("id", id)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error) {
      // Foreign key protects concurrent transactions
      if (error.code === "23503") {
        return jsonError(
          "Barang tidak dapat dihapus karena masih digunakan oleh data lain.",
          409
        );
      }

      console.error("DELETE item error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });

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
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error(
      "DELETE items unexpected error:",
      error
    );

    return jsonError("Internal Server Error", 500);
  }
}
