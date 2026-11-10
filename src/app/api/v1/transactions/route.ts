
import { NextRequest, NextResponse } from "next/server";

import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};

const VALID_TYPES = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
] as const;

const VALID_ARCHIVE_STATUSES = [
  "active",
  "archived",
  "all",
] as const;

type TransactionType = (typeof VALID_TYPES)[number];
type ArchiveStatus = (typeof VALID_ARCHIVE_STATUSES)[number];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_TRANSACTION_QUANTITY = 1_000_000_000;
const MAX_SEARCH_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;
const MAX_PAGE_LIMIT = 50;

// Return consistent API errors
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

// Validate transaction type
function isTransactionType(
  value: unknown
): value is TransactionType {
  return (
    typeof value === "string" &&
    VALID_TYPES.some((type) => type === value)
  );
}

// Validate archive status
function isArchiveStatus(
  value: unknown
): value is ArchiveStatus {
  return (
    typeof value === "string" &&
    VALID_ARCHIVE_STATUSES.some(
      (status) => status === value
    )
  );
}

// Validate positive transaction quantity
function isValidQuantity(
  value: unknown
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    value <= MAX_TRANSACTION_QUANTITY
  );
}

// Escape LIKE wildcards in item-name search
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

// Validate request origin
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

// Validate JSON content type
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

// GET transaction history for active Admin and Staff
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    const params = request.nextUrl.searchParams;

    const search = (params.get("search") ?? "").trim();
    const type = params.get("type") ?? "all";
    const status = params.get("status") ?? "active";
    const pageParam = params.get("page") ?? "1";
    const limitParam = params.get("limit") ?? "10";

    // Validate search and filters
    if (search.length > MAX_SEARCH_LENGTH) {
      return jsonError(
        "Pencarian maksimal 100 karakter.",
        400
      );
    }

    if (type !== "all" && !isTransactionType(type)) {
      return jsonError(
        "Jenis transaksi tidak valid.",
        400
      );
    }

    if (!isArchiveStatus(status)) {
      return jsonError(
        "Status arsip tidak valid.",
        400
      );
    }

    const page = Number(pageParam);
    const limit = Number(limitParam);

    // Validate pagination
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > MAX_PAGE_LIMIT
    ) {
      return jsonError(
        "Parameter pagination tidak valid.",
        400
      );
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    if (
      !Number.isSafeInteger(from) ||
      !Number.isSafeInteger(to)
    ) {
      return jsonError(
        "Parameter pagination terlalu besar.",
        400
      );
    }

    // Return empty search results
    const emptyResult = () =>
      NextResponse.json(
        {
          success: true,
          data: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        },
        {
          status: 200,
          headers: noStoreHeaders,
        }
      );

    let matchingItemIds: string[] | null = null;

    // Search matching inventory items
    if (search) {
      const safeSearch = escapeLike(search);

      const { data: items, error: searchError } =
        await supabaseAdmin
          .from("items")
          .select("id")
          .ilike("name", `%${safeSearch}%`);

      if (searchError) {
        console.error("Transaction search error:", {
          code: searchError.code,
          message: searchError.message,
        });

        return jsonError(
          "Gagal mencari barang.",
          500
        );
      }

      matchingItemIds = (items ?? []).map(
        (item) => item.id
      );

      if (matchingItemIds.length === 0) {
        return emptyResult();
      }
    }

    // Build transaction history query
    let query = supabaseAdmin
      .from("stock_transactions")
      .select(
        `
          id,
          item_id,
          transaction_type,
          quantity,
          notes,
          created_at,
          item:items!inner (
            name,
            unit,
            archived_at
          )
        `,
        {
          count: "exact",
        }
      );

    if (type !== "all") {
      query = query.eq("transaction_type", type);
    }

    if (matchingItemIds !== null) {
      query = query.in("item_id", matchingItemIds);
    }

    if (status === "active") {
      query = query.is("item.archived_at", null);
    } else if (status === "archived") {
      query = query.not(
        "item.archived_at",
        "is",
        null
      );
    }

    // Fetch paginated transaction history
    const { data, count, error } = await query
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      console.error("GET transactions error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      return jsonError(
        "Gagal mengambil riwayat transaksi.",
        500
      );
    }

    // Format transaction response
    const transactions = (data ?? []).map(
      (transaction) => {
        const itemRelation = transaction.item;

        const item = Array.isArray(itemRelation)
          ? itemRelation[0]
          : itemRelation;

        return {
          id: transaction.id,
          item_id: transaction.item_id,
          transaction_type: transaction.transaction_type,
          quantity: Number(transaction.quantity),
          notes: transaction.notes,
          created_at: transaction.created_at,
          item_name: item?.name ?? "Unknown Item",
          unit: item?.unit ?? "",
          item_archived_at: item?.archived_at ?? null,
        };
      }
    );

    const total = count ?? 0;

    return NextResponse.json(
      {
        success: true,
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      {
        status: 200,
        headers: noStoreHeaders,
      }
    );
  } catch (error) {
    console.error(
      "GET transactions unexpected error:",
      error
    );

    return jsonError("Internal Server Error", 500);
  }
}

// POST stock transactions for active Admin and Staff
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyApiStaff();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    // Validate request origin
    const originError = verifyRequestOrigin(request);

    if (originError) {
      return originError;
    }

    // Validate JSON content type
    const contentTypeError =
      verifyJsonContentType(request);

    if (contentTypeError) {
      return contentTypeError;
    }

    // Parse JSON body
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
        "Data transaksi tidak valid.",
        400
      );
    }

    const input = body as Record<string, unknown>;

    // Reject unexpected fields
    const allowedFields = [
      "item_id",
      "transaction_type",
      "quantity",
      "notes",
      "idempotency_key",
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

    const itemId = input.item_id;
    const transactionType = input.transaction_type;
    const quantity = input.quantity;
    const notes = input.notes;
    const idempotencyKey = input.idempotency_key;

    // Validate item ID
    if (
      typeof itemId !== "string" ||
      !UUID_REGEX.test(itemId)
    ) {
      return jsonError(
        "ID barang tidak valid.",
        400
      );
    }

    // Validate transaction type
    if (!isTransactionType(transactionType)) {
      return jsonError(
        "Jenis transaksi tidak valid.",
        400
      );
    }

    // Validate transaction quantity
    if (!isValidQuantity(quantity)) {
      return jsonError(
        "Jumlah transaksi harus lebih besar dari 0 dan maksimal 1.000.000.000.",
        400
      );
    }

    // Validate transaction notes
    if (
      notes !== undefined &&
      notes !== null &&
      (
        typeof notes !== "string" ||
        notes.length > MAX_NOTES_LENGTH
      )
    ) {
      return jsonError(
        "Catatan maksimal 500 karakter.",
        400
      );
    }

    // Require a valid idempotency key
    if (
      typeof idempotencyKey !== "string" ||
      !UUID_REGEX.test(idempotencyKey)
    ) {
      return jsonError(
        "Idempotency key wajib berupa UUID yang valid.",
        400
      );
    }

    // Create transaction through atomic PostgreSQL RPC
    const { data, error } = await supabaseAdmin.rpc(
      "create_stock_transaction",
      {
        p_item_id: itemId,
        p_transaction_type: transactionType,
        p_quantity: quantity,
        p_notes:
          typeof notes === "string"
            ? notes.trim()
            : null,
        p_idempotency_key: idempotencyKey,
      }
    );

    if (error) {
      console.error("Transaction RPC error:", {
        code: error.code,
        message: error.message,
        details: error.details,
      });

      if (
        error.message.includes(
          "IDEMPOTENCY_KEY_CONFLICT"
        )
      ) {
        return jsonError(
          "Idempotency key sudah digunakan untuk transaksi berbeda.",
          409
        );
      }

      if (error.message.includes("ITEM_ARCHIVED")) {
        return jsonError(
          "Barang sudah diarsipkan. Aktifkan kembali sebelum mencatat transaksi.",
          409
        );
      }

      if (
        error.message.includes("INSUFFICIENT_STOCK")
      ) {
        return jsonError(
          "Stok tidak mencukupi untuk transaksi ini.",
          409
        );
      }

      if (error.message.includes("ITEM_NOT_FOUND")) {
        return jsonError(
          "Barang tidak ditemukan.",
          404
        );
      }

      if (
        error.message.includes("INVALID_QUANTITY") ||
        error.message.includes("INVALID_TRANSACTION_TYPE") ||
        error.message.includes("INVALID_NOTES")
      ) {
        return jsonError(
          "Data transaksi tidak valid.",
          400
        );
      }

      return jsonError(
        "Gagal menyimpan transaksi stok.",
        500
      );
    }

    if (typeof data !== "string" || !UUID_REGEX.test(data)) {
      console.error(
        "Transaction RPC returned an invalid ID."
      );

      return jsonError(
        "Respons database tidak valid.",
        500
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Transaksi stok berhasil dicatat.",
        data: {
          id: data,
          item_id: itemId,
          transaction_type: transactionType,
          quantity,
        },
      },
      {
        status: 201,
        headers: noStoreHeaders,
      }
    );
  } catch (error) {
    console.error(
      "POST transactions unexpected error:",
      error
    );

    return jsonError("Internal Server Error", 500);
  }
}
