
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

const validCategories = [
  "raw_material",
  "finished_product",
];

const validUnits = ["kg", "pcs", "liter", "gram"];

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status, headers }
  );
}

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

function verifyOrigin(request: NextRequest) {
  const allowedOrigin =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "");

  if (!allowedOrigin) {
    return jsonError(
      "APP_ORIGIN belum dikonfigurasi.",
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

async function verifyMutation(request: NextRequest) {
  const authError = await verifyAdmin();
  if (authError) return authError;

  const originError = verifyOrigin(request);
  if (originError) return originError;

  return null;
}

async function hasTransactions(itemId: string) {
  const { data, error } = await supabaseAdmin
    .from("stock_transactions")
    .select("id")
    .eq("item_id", itemId)
    .limit(1);

  if (error) throw error;

  return (data?.length ?? 0) > 0;
}

// PATCH /api/v1/items/[id]
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

    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !/^application\/json(?:\s*;|$)/i.test(contentType)
    ) {
      return jsonError(
        "Content-Type harus application/json.",
        415
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError("Format JSON tidak valid.", 400);
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonError("Data barang tidak valid.", 400);
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
      return jsonError(
        "Terdapat field yang tidak diizinkan.",
        400
      );
    }

    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : "";

    const category = input.category;
    const unit = input.unit;
    const minimumStock = input.minimum_stock;

    if (
      name.length === 0 ||
      name.length > 150 ||
      typeof category !== "string" ||
      !validCategories.includes(category) ||
      typeof unit !== "string" ||
      !validUnits.includes(unit) ||
      typeof minimumStock !== "number" ||
      !Number.isFinite(minimumStock) ||
      minimumStock < 0
    ) {
      return jsonError(
        "Periksa kembali data barang.",
        400
      );
    }

    const { data: existing, error: lookupError } =
      await supabaseAdmin
        .from("items")
        .select("id, unit, archived_at")
        .eq("id", id)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (!existing) {
      return jsonError("Barang tidak ditemukan.", 404);
    }

    // Archived items cannot be edited.
    if (existing.archived_at !== null) {
      return jsonError(
        "Barang sudah diarsipkan. Aktifkan kembali sebelum mengedit barang.",
        409
      );
    }

    // Preserve historical transaction units.
    if (
      unit !== existing.unit &&
      (await hasTransactions(id))
    ) {
      return jsonError(
        "Satuan barang tidak dapat diubah karena sudah memiliki riwayat transaksi.",
        409
      );
    }

    const { data, error } = await supabaseAdmin
      .from("items")
      .update({
        name,
        category,
        unit,
        minimum_stock: minimumStock,
      })
      .eq("id", id)
      .is("archived_at", null)
      .select(
        "id, name, category, unit, initial_stock, minimum_stock"
      )
      .maybeSingle();

    if (error) {
      console.error("PATCH item error:", error);

      return jsonError(
        "Gagal memperbarui barang.",
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
        message: "Barang berhasil diperbarui.",
        data,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("PATCH items error:", error);

    return jsonError("Internal Server Error", 500);
  }
}

// DELETE /api/v1/items/[id]
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

    // Archived items cannot be deleted.
    if (existing.archived_at !== null) {
      return jsonError(
        "Barang sudah diarsipkan. Aktifkan kembali sebelum menghapus barang.",
        409
      );
    }

    // Preserve transaction history.
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

      console.error("DELETE item error:", error);

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
