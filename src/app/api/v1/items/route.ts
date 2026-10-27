
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
};

type AuthResult =
  | { authorized: true }
  | {
      authorized: false;
      status: number;
      message: string;
    };

async function verifyAdmin(): Promise<AuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized. Silakan login terlebih dahulu.",
    };
  }

  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId) {
    console.error("ADMIN_USER_ID belum dikonfigurasi.");

    return {
      authorized: false,
      status: 500,
      message: "Konfigurasi server belum lengkap.",
    };
  }

  if (user.id !== adminUserId) {
    return {
      authorized: false,
      status: 403,
      message: "Forbidden. Hanya admin yang dapat mengakses data.",
    };
  }

  return { authorized: true };
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    {
      success: false,
      message,
    },
    {
      status,
      headers: noStoreHeaders,
    }
  );
}

function verifyRequestOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  const allowedOrigin =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "");

  if (!allowedOrigin) {
    console.error("APP_ORIGIN belum dikonfigurasi.");

    return jsonError(
      "Konfigurasi origin server belum lengkap.",
      500
    );
  }

  if (origin !== allowedOrigin) {
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

// GET /api/v1/items
// Retrieve inventory data for admin.
export async function GET() {
  try {
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    const { data, error } = await supabaseAdmin
      .from("inventory_current_stock")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error(
        "GET inventory error:",
        error.message
      );

      return jsonError(
        "Gagal mengambil data inventory.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Data inventory berhasil diambil.",
        data: data ?? [],
      },
      {
        status: 200,
        headers: noStoreHeaders,
      }
    );
  } catch (error) {
    console.error("GET items error:", error);

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}

// POST /api/v1/items
// Create a new inventory item for admin.
export async function POST(request: NextRequest) {
  try {
    // Verify admin access before processing input.
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    // Verify request origin.
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    // Verify JSON content type.
    const contentTypeError =
      verifyJsonContentType(request);

    if (contentTypeError) {
      return contentTypeError;
    }

    // Parse request body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Format JSON tidak valid.",
        400
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return jsonError(
        "Data barang tidak valid.",
        400
      );
    }

    const input = body as Record<string, unknown>;

    // Normalize and validate fields.
    const name =
      typeof input.name === "string"
        ? input.name.trim()
        : "";

    const category = input.category;
    const unit = input.unit;
    const initialStock = input.initial_stock;
    const minimumStock = input.minimum_stock;

    const validCategories = [
      "raw_material",
      "finished_product",
    ];

    const validUnits = [
      "kg",
      "pcs",
      "liter",
      "gram",
    ];

    if (
      name.length === 0 ||
      name.length > 150 ||
      typeof category !== "string" ||
      !validCategories.includes(category) ||
      typeof unit !== "string" ||
      !validUnits.includes(unit) ||
      typeof initialStock !== "number" ||
      !Number.isFinite(initialStock) ||
      initialStock < 0 ||
      typeof minimumStock !== "number" ||
      !Number.isFinite(minimumStock) ||
      minimumStock < 0
    ) {
      return jsonError(
        "Periksa kembali nama, kategori, unit, dan jumlah stok.",
        400
      );
    }

    // Insert item after authorization and validation.
    const { data, error } = await supabaseAdmin
      .from("items")
      .insert({
        name,
        category,
        unit,
        initial_stock: initialStock,
        minimum_stock: minimumStock,
      })
      .select(
        "id, name, category, unit, initial_stock, minimum_stock"
      )
      .single();

    if (error) {
      console.error(
        "POST inventory error:",
        error.message
      );

      return jsonError(
        "Gagal menyimpan barang ke database.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil ditambahkan.",
        data,
      },
      {
        status: 201,
        headers: noStoreHeaders,
      }
    );
  } catch (error) {
    console.error("POST items error:", error);

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}
