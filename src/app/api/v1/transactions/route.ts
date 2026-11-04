
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// CONSTANTS & TYPES

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
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

type TransactionType =
  (typeof VALID_TYPES)[number];

type ArchiveStatus =
  (typeof VALID_ARCHIVE_STATUSES)[number];

type AuthResult =
  | { authorized: true }
  | {
      authorized: false;
      status: number;
      message: string;
    };

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Application-level limit.
// Adjust according to database precision.
const MAX_TRANSACTION_QUANTITY = 1_000_000_000;

const MAX_SEARCH_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;
const MAX_PAGE_LIMIT = 50;

// RESPONSE HELPERS

function jsonError(
  message: string,
  status: number
) {
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


// AUTHENTICATION & AUTHORIZATION


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
        "Konfigurasi admin belum lengkap.",
    };
  }

  if (user.id !== adminUserId) {
    return {
      authorized: false,
      status: 403,
      message:
        "Forbidden. Hanya admin yang dapat mengakses transaksi.",
    };
  }

  return { authorized: true };
}

// VALIDATION HELPERS


function isTransactionType(
  value: unknown
): value is TransactionType {
  return (
    typeof value === "string" &&
    VALID_TYPES.some((type) => type === value)
  );
}

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

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

function verifyRequestOrigin(
  request: NextRequest
) {
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
    const parsedOrigin = new URL(
      configuredOrigin
    );

    if (
      !["http:", "https:"].includes(
        parsedOrigin.protocol
      )
    ) {
      throw new Error(
        "Invalid origin protocol"
      );
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


// GET /api/v1/transactions


export async function GET(
  request: NextRequest
) {
  try {
    // 1. Verify admin.
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(
        auth.message,
        auth.status
      );
    }

    // 2. Read query parameters.
    const params =
      request.nextUrl.searchParams;

    const search = (
      params.get("search") ?? ""
    ).trim();

    const type =
      params.get("type") ?? "all";

    const status =
      params.get("status") ?? "active";

    const pageParam =
      params.get("page") ?? "1";

    const limitParam =
      params.get("limit") ?? "10";

    // 3. Validate filters.
    if (
      search.length > MAX_SEARCH_LENGTH
    ) {
      return jsonError(
        "Pencarian maksimal 100 karakter.",
        400
      );
    }

    if (
      type !== "all" &&
      !isTransactionType(type)
    ) {
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

    // 4. Empty response helper.
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

    // SEARCH ITEMS


    let matchingItemIds:
      | string[]
      | null = null;

    if (search) {
      const safeSearch =
        escapeLike(search);

      const {
        data: items,
        error: searchError,
      } = await supabaseAdmin
        .from("items")
        .select("id")
        .ilike(
          "name",
          `%${safeSearch}%`
        );

      if (searchError) {
        console.error(
          "Transaction search error:",
          {
            code: searchError.code,
            message:
              searchError.message,
          }
        );

        return jsonError(
          "Gagal mencari barang.",
          500
        );
      }

      matchingItemIds = (
        items ?? []
      ).map((item) => item.id);

      if (
        matchingItemIds.length === 0
      ) {
        return emptyResult();
      }
    }

    // FETCH TRANSACTIONS
 

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

    // Filter by transaction type.
    if (type !== "all") {
      query = query.eq(
        "transaction_type",
        type
      );
    }

    // Filter by matching items.
    if (
      matchingItemIds !== null
    ) {
      query = query.in(
        "item_id",
        matchingItemIds
      );
    }

    // Filter by archive status.
    if (status === "active") {
      query = query.is(
        "item.archived_at",
        null
      );
    } else if (
      status === "archived"
    ) {
      query = query.not(
        "item.archived_at",
        "is",
        null
      );
    }

    const {
      data,
      count,
      error,
    } = await query
      .order("created_at", {
        ascending: false,
      })
      .order("id", {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      console.error(
        "GET transactions error:",
        {
          code: error.code,
          message: error.message,
          details: error.details,
        }
      );

      return jsonError(
        "Gagal mengambil riwayat transaksi.",
        500
      );
    }

    // FORMAT RESPONSE


    const transactions = (
      data ?? []
    ).map((transaction) => {
      const itemRelation =
        transaction.item;

      const item = Array.isArray(
        itemRelation
      )
        ? itemRelation[0]
        : itemRelation;

      return {
        id: transaction.id,
        item_id:
          transaction.item_id,
        transaction_type:
          transaction.transaction_type,
        quantity: Number(
          transaction.quantity
        ),
        notes:
          transaction.notes,
        created_at:
          transaction.created_at,
        item_name:
          item?.name ??
          "Unknown Item",
        unit:
          item?.unit ?? "",
        item_archived_at:
          item?.archived_at ??
          null,
      };
    });

    const total = count ?? 0;

    return NextResponse.json(
      {
        success: true,
        data: transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages:
            Math.ceil(total / limit),
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

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}

// POST /api/v1/transactions


export async function POST(
  request: NextRequest
) {
  try {
    // 1. Verify admin.
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(
        auth.message,
        auth.status
      );
    }

    // 2. Verify origin.
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

    // 4. Parse JSON.
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

    const input =
      body as Record<string, unknown>;

    // 5. Reject unexpected fields.
    const allowedFields = [
      "item_id",
      "transaction_type",
      "quantity",
      "notes",
    ];

    if (
      Object.keys(input).some(
        (key) =>
          !allowedFields.includes(
            key
          )
      )
    ) {
      return jsonError(
        "Terdapat field yang tidak diizinkan.",
        400
      );
    }

    const itemId =
      input.item_id;

    const transactionType =
      input.transaction_type;

    const quantity =
      input.quantity;

    const notes =
      input.notes;

    // 6. Validate item ID.
    if (
      typeof itemId !== "string" ||
      !UUID_REGEX.test(itemId)
    ) {
      return jsonError(
        "ID barang tidak valid.",
        400
      );
    }

    // 7. Validate transaction type.
    if (
      !isTransactionType(
        transactionType
      )
    ) {
      return jsonError(
        "Jenis transaksi tidak valid.",
        400
      );
    }

    // 8. Validate quantity.
    if (
      !isValidQuantity(quantity)
    ) {
      return jsonError(
        "Jumlah transaksi harus lebih besar dari 0 dan maksimal 1.000.000.000.",
        400
      );
    }

    // 9. Validate notes.
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

    // CREATE STOCK TRANSACTION


    // Atomic stock updates and archived
    // item protection must be enforced
    // inside the PostgreSQL RPC.
    const {
      data,
      error,
    } = await supabaseAdmin.rpc(
      "create_stock_transaction",
      {
        p_item_id: itemId,
        p_transaction_type:
          transactionType,
        p_quantity: quantity,
        p_notes:
          typeof notes === "string"
            ? notes.trim()
            : null,
      }
    );

    if (error) {
      console.error(
        "Transaction RPC error:",
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );

      if (
        error.message.includes(
          "ITEM_ARCHIVED"
        )
      ) {
        return jsonError(
          "Barang sudah diarsipkan. Aktifkan kembali sebelum mencatat transaksi.",
          409
        );
      }

      if (
        error.message.includes(
          "INSUFFICIENT_STOCK"
        )
      ) {
        return jsonError(
          "Stok tidak mencukupi untuk transaksi ini.",
          409
        );
      }

      if (
        error.message.includes(
          "ITEM_NOT_FOUND"
        )
      ) {
        return jsonError(
          "Barang tidak ditemukan.",
          404
        );
      }

      if (
        error.message.includes(
          "INVALID_QUANTITY"
        ) ||
        error.message.includes(
          "INVALID_TRANSACTION_TYPE"
        )
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


    return NextResponse.json(
      {
        success: true,
        message:
          "Transaksi stok berhasil dicatat.",
        data: {
          id: data,
          item_id: itemId,
          transaction_type:
            transactionType,
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

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}
