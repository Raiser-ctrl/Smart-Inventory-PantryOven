
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
};

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
      "Forbidden. Hanya admin yang dapat mengaktifkan barang.",
      403
    );
  }

  return null;
}

// ==========================================
// ORIGIN VALIDATION
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
      "Konfigurasi server belum lengkap.",
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

// ==========================================
// POST /api/v1/items/[id]/restore
// ==========================================

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // 1. Verify admin access.
    const authError = await verifyAdmin();

    if (authError) return authError;

    // 2. Verify request origin.
    const originError = verifyOrigin(request);

    if (originError) return originError;

    // 3. Validate item ID.
    const { id } = await context.params;

    if (!uuidPattern.test(id)) {
      return jsonError("ID barang tidak valid.", 400);
    }

    // 4. Restore item atomically using PostgreSQL RPC.
    const { data, error } = await supabaseAdmin.rpc(
      "restore_inventory_item",
      {
        p_item_id: id,
      }
    );

    if (error) {
      if (error.message.includes("ITEM_NOT_FOUND")) {
        return jsonError(
          "Barang tidak ditemukan.",
          404
        );
      }

      if (
        error.message.includes("ITEM_ALREADY_ACTIVE")
      ) {
        return jsonError(
          "Barang sudah aktif.",
          409
        );
      }

      console.error(
        "RESTORE item RPC error:",
        error.message
      );

      return jsonError(
        "Gagal mengaktifkan barang.",
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
        message: "Barang berhasil diaktifkan kembali.",
        data: {
          id: data.id,
          name: data.name,
          archived_at: data.archived_at,
        },
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("RESTORE item error:", error);

    return jsonError(
      "Gagal mengaktifkan barang.",
      500
    );
  }
}
