
import { NextRequest, NextResponse } from "next/server";

import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const responseHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RouteContext = {
  params: Promise<{ id: string }>;
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

// Verify same-origin requests
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

// POST /api/v1/items/[id]/archive
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // Verify active Admin or Staff
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    // Verify request origin
    const originError = verifyOrigin(request);

    if (originError) {
      return originError;
    }

    // Validate item ID
    const { id } = await context.params;

    if (!UUID_REGEX.test(id)) {
      return jsonError("ID barang tidak valid.", 400);
    }

    // Archive item through PostgreSQL RPC
    const { data, error } = await supabaseAdmin.rpc(
      "archive_inventory_item",
      {
        p_item_id: id,
      }
    );

    if (error) {
      const message = error.message;

      if (message.includes("ITEM_NOT_FOUND")) {
        return jsonError("Barang tidak ditemukan.", 404);
      }

      if (
        message.includes("ITEM_ALREADY_ARCHIVED")
      ) {
        return jsonError(
          "Barang sudah diarsipkan.",
          409
        );
      }

      console.error("ARCHIVE item RPC error:", {
        code: error.code,
        message: error.message,
      });

      return jsonError(
        "Gagal mengarsipkan barang.",
        500
      );
    }

    if (!data) {
      return jsonError("Barang tidak ditemukan.", 404);
    }

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil diarsipkan.",
        data: {
          id: data.id,
          name: data.name,
          archived_at: data.archived_at,
        },
      },
      {
        status: 200,
        headers: responseHeaders,
      }
    );
  } catch (error) {
    console.error("ARCHIVE item error:", error);

    return jsonError(
      "Gagal mengarsipkan barang.",
      500
    );
  }
}
