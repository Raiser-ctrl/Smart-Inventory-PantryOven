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

async function verifyMutation(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return jsonError("Silakan login terlebih dahulu.", 401);
  }

  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId) {
    return jsonError("Konfigurasi server belum lengkap.", 500);
  }

  if (user.id !== adminUserId) {
    return jsonError("Hanya admin yang diizinkan.", 403);
  }

  const allowedOrigin =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "");

  if (!allowedOrigin) {
    return jsonError("APP_ORIGIN belum dikonfigurasi.", 500);
  }

  if (request.headers.get("origin") !== allowedOrigin) {
    return jsonError("Origin request tidak diizinkan.", 403);
  }

  return null;
}

// POST /api/v1/items/[id]/restore
export async function POST(
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

    if (existing.archived_at === null) {
      return jsonError("Barang sudah aktif.", 409);
    }

    const { data, error } = await supabaseAdmin
      .from("items")
      .update({
        archived_at: null,
      })
      .eq("id", id)
      .not("archived_at", "is", null)
      .select("id, name, archived_at")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return jsonError(
        "Status barang sudah berubah. Silakan muat ulang.",
        409
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil diaktifkan kembali.",
        data,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("RESTORE item error:", error);
    return jsonError("Gagal mengaktifkan barang.", 500);
  }
}