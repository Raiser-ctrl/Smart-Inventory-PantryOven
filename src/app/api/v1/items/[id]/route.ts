
import { NextRequest, NextResponse } from "next/server";

import {
  verifyApiAdmin,
  verifyApiStaff,
} from "@/lib/api-auth";
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
const MAX_BODY_SIZE = 10 * 1024;

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

// Verify same-origin mutations.
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

// Validate JSON requests.
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

// Check declared body size before parsing.
function verifyBodySize(request: NextRequest) {
  const contentLength = request.headers.get("content-length");

  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      return jsonError(
        "Content-Length tidak valid.",
        400
      );
    }

    if (Number(contentLength) > MAX_BODY_SIZE) {
      return jsonError(
        "Ukuran request terlalu besar.",
        413
      );
    }
  }

  return null;
}

// Read JSON with an actual byte-size limit.
async function readJsonBody(
  request: NextRequest
): Promise<
  | { success: true; data: unknown }
  | { success: false; response: NextResponse }
> {
  const sizeError = verifyBodySize(request);

  if (sizeError) {
    return {
      success: false,
      response: sizeError,
    };
  }

  try {
    if (!request.body) {
      return {
        success: false,
        response: jsonError(
          "Request body wajib diisi.",
          400
        ),
      };
    }

    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        totalSize += value.byteLength;

        if (totalSize > MAX_BODY_SIZE) {
          await reader.cancel();

          return {
            success: false,
            response: jsonError(
              "Ukuran request terlalu besar.",
              413
            ),
          };
        }

        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }

    const combined = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder("utf-8", {
      fatal: true,
    }).decode(combined);

    return {
      success: true,
      data: JSON.parse(text),
    };
  } catch {
    return {
      success: false,
      response: jsonError(
        "Format JSON tidak valid.",
        400
      ),
    };
  }
}

// Authorize Staff/Admin mutations.
async function verifyMutation(request: NextRequest) {
  const auth = await verifyApiStaff();

  if (!auth.authorized) {
    return jsonError(auth.message, auth.status);
  }

  return verifyOrigin(request);
}

// Authorize Admin-only mutations.
async function verifyAdminMutation(request: NextRequest) {
  const auth = await verifyApiAdmin();

  if (!auth.authorized) {
    return jsonError(auth.message, auth.status);
  }

  return verifyOrigin(request);
}

// Validate inventory update payload.
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

// Validate the returned item from update RPC.
function isValidUpdatedItem(data: unknown): boolean {
  if (!data || typeof data !== "object") {
    return false;
  }

  const item = data as Record<string, unknown>;

  return (
    typeof item.id === "string" &&
    UUID_REGEX.test(item.id) &&
    typeof item.name === "string" &&
    VALID_CATEGORIES.some(
      (value) => value === item.category
    ) &&
    VALID_UNITS.some(
      (value) => value === item.unit
    ) &&
    typeof item.initial_stock === "number" &&
    Number.isFinite(item.initial_stock) &&
    typeof item.minimum_stock === "number" &&
    Number.isFinite(item.minimum_stock) &&
    item.minimum_stock >= 0 &&
    item.minimum_stock <= MAX_STOCK
  );
}

// PATCH /api/v1/items/[id]
// Admin and active Staff can update items.
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
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

    const parsed = await readJsonBody(request);

    if (!parsed.success) {
      return parsed.response;
    }

    const validation = validateItemInput(parsed.data);

    if (!validation.valid) {
      return jsonError(validation.message, 400);
    }

    const {
      name,
      category,
      unit,
      minimum_stock,
    } = validation.data;

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
        message.includes("UNIT_CHANGE_HAS_TRANSACTIONS")
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

    if (!isValidUpdatedItem(data)) {
      console.error(
        "PATCH item RPC returned invalid data."
      );

      return jsonError(
        "Respons database tidak valid.",
        500
      );
    }

    const item = data as Record<string, unknown>;

    return NextResponse.json(
      {
        success: true,
        message: "Barang berhasil diperbarui.",
        data: {
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          initial_stock: item.initial_stock,
          minimum_stock: item.minimum_stock,
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

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}

// DELETE /api/v1/items/[id]
// Admin only. Performs soft deletion through archive RPC.
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const securityError =
      await verifyAdminMutation(request);

    if (securityError) {
      return securityError;
    }

    const { id } = await context.params;

    if (!UUID_REGEX.test(id)) {
      return jsonError("ID barang tidak valid.", 400);
    }

    const { data, error } = await supabaseAdmin.rpc(
      "archive_inventory_item",
      {
        p_item_id: id,
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

      if (message.includes("ITEM_ALREADY_ARCHIVED")) {
        return jsonError(
          "Barang sudah diarsipkan.",
          409
        );
      }

      console.error("DELETE item archive RPC error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      return jsonError(
        "Gagal mengarsipkan barang.",
        500
      );
    }

    if (
      !data ||
      typeof data !== "object" ||
      typeof data.id !== "string" ||
      !UUID_REGEX.test(data.id) ||
      typeof data.name !== "string" ||
      typeof data.archived_at !== "string" ||
      !Number.isFinite(Date.parse(data.archived_at))
    ) {
      console.error(
        "Archive item RPC returned invalid data."
      );

      return jsonError(
        "Respons database tidak valid.",
        500
      );
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
    console.error(
      "DELETE items unexpected error:",
      error
    );

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}
