
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
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

// Application-level stock limit.
// Adjust if the business needs larger quantities.
const MAX_STOCK = 1_000_000_000;

type AuthResult =
  | { authorized: true }
  | {
      authorized: false;
      status: number;
      message: string;
    };

type ItemInput = {
  name: string;
  category: (typeof VALID_CATEGORIES)[number];
  unit: (typeof VALID_UNITS)[number];
  initial_stock: number;
  minimum_stock: number;
};

// ==========================================
// RESPONSE HELPERS
// ==========================================

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

// ==========================================
// AUTHORIZATION
// ==========================================

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
      message:
        "Unauthorized. Silakan login terlebih dahulu.",
    };
  }

  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId) {
    console.error(
      "ADMIN_USER_ID belum dikonfigurasi."
    );

    return {
      authorized: false,
      status: 500,
      message:
        "Konfigurasi server belum lengkap.",
    };
  }

  if (user.id !== adminUserId) {
    return {
      authorized: false,
      status: 403,
      message:
        "Forbidden. Hanya admin yang dapat mengakses data.",
    };
  }

  return { authorized: true };
}

// ==========================================
// REQUEST VALIDATION
// ==========================================

function verifyRequestOrigin(request: NextRequest) {
  const requestOrigin =
    request.headers.get("origin");

  const configuredOrigin =
    process.env.APP_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3000"
      : "");

  if (!configuredOrigin) {
    console.error(
      "APP_ORIGIN belum dikonfigurasi."
    );

    return jsonError(
      "Konfigurasi origin server belum lengkap.",
      500
    );
  }

  let allowedOrigin: string;

  try {
    const parsedOrigin = new URL(configuredOrigin);

    if (
      !["http:", "https:"].includes(
        parsedOrigin.protocol
      ) ||
      parsedOrigin.origin === "null"
    ) {
      throw new Error("Invalid origin protocol");
    }

    allowedOrigin = parsedOrigin.origin;
  } catch {
    console.error(
      "APP_ORIGIN tidak valid."
    );

    return jsonError(
      "Konfigurasi origin server tidak valid.",
      500
    );
  }

  if (requestOrigin !== allowedOrigin) {
    return jsonError(
      "Origin request tidak diizinkan.",
      403
    );
  }

  return null;
}

function verifyJsonContentType(
  request: NextRequest
) {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !/^application\/json(?:\s*;|$)/i.test(
      contentType
    )
  ) {
    return jsonError(
      "Content-Type harus application/json.",
      415
    );
  }

  return null;
}

function isValidStock(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_STOCK
  );
}

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

  const name =
    typeof input.name === "string"
      ? input.name.trim()
      : "";

  const category = input.category;
  const unit = input.unit;

  if (
    name.length === 0 ||
    name.length > 150
  ) {
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
      message:
        "Kategori barang tidak valid.",
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
      message:
        "Satuan barang tidak valid.",
    };
  }

  if (
    !isValidStock(input.initial_stock) ||
    !isValidStock(input.minimum_stock)
  ) {
    return {
      valid: false,
      message:
        "Stok awal dan stok minimum harus berupa angka antara 0 dan 1.000.000.000.",
    };
  }

  return {
    valid: true,
    data: {
      name,
      category:
        category as ItemInput["category"],
      unit: unit as ItemInput["unit"],
      initial_stock: input.initial_stock,
      minimum_stock: input.minimum_stock,
    },
  };
}

// ==========================================
// GET /api/v1/items
// ==========================================

export async function GET() {
  try {
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(
        auth.message,
        auth.status
      );
    }

    const { data, error } = await supabaseAdmin
      .from("inventory_current_stock")
      .select("*")
      .order("name", {
        ascending: true,
      });

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
        message:
          "Data inventory berhasil diambil.",
        data: data ?? [],
      },
      {
        status: 200,
        headers: noStoreHeaders,
      }
    );
  } catch (error) {
    console.error(
      "GET items error:",
      error
    );

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}

// ==========================================
// POST /api/v1/items
// ==========================================

export async function POST(
  request: NextRequest
) {
  try {
    // 1. Verify admin access.
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(
        auth.message,
        auth.status
      );
    }

    // 2. Verify request origin.
    const originError =
      verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    // 3. Verify content type.
    const contentTypeError =
      verifyJsonContentType(request);

    if (contentTypeError) {
      return contentTypeError;
    }

    // 4. Parse JSON body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return jsonError(
        "Format JSON tidak valid.",
        400
      );
    }

    // 5. Validate input.
    const validation =
      validateItemInput(body);

    if (!validation.valid) {
      return jsonError(
        validation.message,
        400
      );
    }

    // 6. Insert item into database.
    const { data, error } = await supabaseAdmin
      .from("items")
      .insert(validation.data)
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
        message:
          "Barang berhasil ditambahkan.",
        data,
      },
      {
        status: 201,
        headers: noStoreHeaders,
      }
    );
  } catch (error) {
    console.error(
      "POST items error:",
      error
    );

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}
