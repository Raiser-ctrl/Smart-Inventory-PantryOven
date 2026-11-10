
import { NextRequest, NextResponse } from "next/server";

import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
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

const ALLOWED_ITEM_FIELDS = [
  "name",
  "category",
  "unit",
  "initial_stock",
  "minimum_stock",
  "idempotency_key",
] as const;

const MAX_STOCK = 1_000_000_000;
const MAX_NAME_LENGTH = 150;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ItemInput = {
  name: string;
  category: (typeof VALID_CATEGORIES)[number];
  unit: (typeof VALID_UNITS)[number];
  initial_stock: number;
  minimum_stock: number;
  idempotency_key: string;
};

type CreatedItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  initial_stock: number;
  minimum_stock: number;
};

type CreateItemRpcResponse = {
  item: CreatedItem;
  replayed: boolean;
};

// Consistent API error response
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

// Verify same-origin write requests
function verifyRequestOrigin(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");

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
    const parsedOrigin = new URL(configuredOrigin);

    if (
      !["http:", "https:"].includes(parsedOrigin.protocol) ||
      parsedOrigin.origin === "null" ||
      parsedOrigin.username ||
      parsedOrigin.password ||
      parsedOrigin.pathname !== "/" ||
      parsedOrigin.search ||
      parsedOrigin.hash
    ) {
      throw new Error("Invalid APP_ORIGIN");
    }

    allowedOrigin = parsedOrigin.origin;
  } catch {
    console.error("APP_ORIGIN tidak valid.");

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

// Validate JSON Content-Type
function verifyJsonContentType(request: NextRequest) {
  const contentType =
    request.headers.get("content-type") ?? "";

  if (
    !/^application\/json(?:\s*;\s*charset\s*=\s*[\w-]+)?\s*$/i.test(
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

// Validate stock numeric values
function isValidStock(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= MAX_STOCK
  );
}

// Validate UUID
function isValidUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    UUID_REGEX.test(value)
  );
}

// Validate item creation payload
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
  const hasUnexpectedFields = Object.keys(input).some(
    (key) =>
      !ALLOWED_ITEM_FIELDS.some(
        (allowedField) => allowedField === key
      )
  );

  if (hasUnexpectedFields) {
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
    !isValidStock(input.initial_stock) ||
    !isValidStock(input.minimum_stock)
  ) {
    return {
      valid: false,
      message:
        "Stok awal dan stok minimum harus berupa angka antara 0 dan 1.000.000.000.",
    };
  }

  if (!isValidUuid(input.idempotency_key)) {
    return {
      valid: false,
      message:
        "Idempotency key wajib berupa UUID valid.",
    };
  }

  return {
    valid: true,
    data: {
      name,
      category: category as ItemInput["category"],
      unit: unit as ItemInput["unit"],
      initial_stock: input.initial_stock,
      minimum_stock: input.minimum_stock,
      idempotency_key: input.idempotency_key,
    },
  };
}

// Validate RPC response before returning it
function isCreateItemRpcResponse(
  value: unknown
): value is CreateItemRpcResponse {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const result = value as Record<string, unknown>;

  if (
    typeof result.replayed !== "boolean" ||
    !result.item ||
    typeof result.item !== "object" ||
    Array.isArray(result.item)
  ) {
    return false;
  }

  const item = result.item as Record<string, unknown>;

  return (
    isValidUuid(item.id) &&
    typeof item.name === "string" &&
    typeof item.category === "string" &&
    typeof item.unit === "string" &&
    isValidStock(item.initial_stock) &&
    isValidStock(item.minimum_stock)
  );
}

// GET active inventory for Admin and Staff
export async function GET() {
  try {
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    const { data, error } = await supabaseAdmin
      .from("inventory_current_stock")
      .select(
        `
          id,
          name,
          category,
          unit,
          initial_stock,
          minimum_stock,
          current_stock,
          archived_at
        `
      )
      .is("archived_at", null)
      .order("name", {
        ascending: true,
      });

    if (error) {
      console.error("GET inventory error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });

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
    console.error(
      "GET items unexpected error:",
      error
    );

    return jsonError("Internal Server Error", 500);
  }
}

// POST inventory with idempotency protection
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    const contentTypeError =
      verifyJsonContentType(request);

    if (contentTypeError) {
      return contentTypeError;
    }

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
      return jsonError(
        validation.message,
        400
      );
    }

    const item = validation.data;

    // Atomic database operation via PostgreSQL RPC
    const { data, error } = await supabaseAdmin.rpc(
      "create_inventory_item",
      {
        p_name: item.name,
        p_category: item.category,
        p_unit: item.unit,
        p_initial_stock: item.initial_stock,
        p_minimum_stock: item.minimum_stock,
        p_idempotency_key: item.idempotency_key,
      }
    );

    if (error) {
      const message = error.message;

      if (
        message.includes("IDEMPOTENCY_KEY_CONFLICT")
      ) {
        return jsonError(
          "Idempotency key sudah digunakan untuk data barang berbeda.",
          409
        );
      }

      if (
        message.includes("INVALID_ITEM_INPUT") ||
        message.includes("INVALID_IDEMPOTENCY_KEY")
      ) {
        return jsonError(
          "Data barang tidak valid.",
          400
        );
      }

      if (
        message.includes("IDEMPOTENCY_RETRY_REQUIRED")
      ) {
        return jsonError(
          "Permintaan belum selesai. Silakan ulangi dengan key yang sama.",
          503
        );
      }

      console.error("POST inventory RPC error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      return jsonError(
        "Gagal menyimpan barang ke database.",
        500
      );
    }

    if (!isCreateItemRpcResponse(data)) {
      console.error(
        "POST inventory RPC returned invalid data."
      );

      return jsonError(
        "Respons database tidak valid.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: data.replayed
          ? "Barang sudah berhasil ditambahkan sebelumnya."
          : "Barang berhasil ditambahkan.",
        data: data.item,
      },
      {
        status: data.replayed ? 200 : 201,
        headers: noStoreHeaders,
      }
    );
  } catch (error) {
    console.error(
      "POST items unexpected error:",
      error
    );

    return jsonError("Internal Server Error", 500);
  }
}
