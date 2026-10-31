
import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store",
};

type TransactionType =
  | "stock_in"
  | "stock_out"
  | "usage"
  | "waste";

type ArchiveStatus =
  | "active"
  | "archived"
  | "all";

const validTypes: TransactionType[] = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
];

const validArchiveStatuses: ArchiveStatus[] = [
  "active",
  "archived",
  "all",
];

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ==========================================
// RESPONSE HELPER
// ==========================================

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

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

async function verifyAdmin(): Promise<
  | { authorized: true }
  | {
      authorized: false;
      status: number;
      message: string;
    }
> {
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
    console.error("ADMIN_USER_ID is missing");

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

// ==========================================
// SEARCH HELPER
// ==========================================

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

// ==========================================
// GET /api/v1/transactions
// ==========================================

export async function GET(
  request: NextRequest
) {
  try {
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(
        auth.message,
        auth.status
      );
    }

    const params = request.nextUrl.searchParams;

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

    // --------------------------------------
    // VALIDATION
    // --------------------------------------

    if (search.length > 100) {
      return jsonError(
        "Pencarian maksimal 100 karakter.",
        400
      );
    }

    if (
      type !== "all" &&
      !validTypes.includes(
        type as TransactionType
      )
    ) {
      return jsonError(
        "Jenis transaksi tidak valid.",
        400
      );
    }

    if (
      !validArchiveStatuses.includes(
        status as ArchiveStatus
      )
    ) {
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
      limit > 50
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

    // --------------------------------------
    // SEARCH INVENTORY ITEMS
    // --------------------------------------

    // Search includes active and archived items.
    let matchingItemIds: string[] | null = null;

    if (search) {
      const safeSearch = escapeLike(search);

      const { data: items, error } =
        await supabaseAdmin
          .from("items")
          .select("id")
          .ilike(
            "name",
            `%${safeSearch}%`
          );

      if (error) {
        console.error(
          "Transaction search error:",
          {
            code: error.code,
            message: error.message,
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

    // --------------------------------------
    // FETCH TRANSACTION HISTORY
    // --------------------------------------

    // Join items so archived_at can be
    // filtered before pagination.
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

    // Filter transaction type.
    if (type !== "all") {
      query = query.eq(
        "transaction_type",
        type
      );
    }

    // Filter searched item IDs.
    if (matchingItemIds !== null) {
      query = query.in(
        "item_id",
        matchingItemIds
      );
    }

    // Filter archive status using
    // current item archived_at.
    if (status === "active") {
      query = query.is(
        "item.archived_at",
        null
      );
    }

    if (status === "archived") {
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

    // --------------------------------------
    // FORMAT TRANSACTION RESPONSE
    // --------------------------------------

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
        notes: transaction.notes,
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

// ==========================================
// POST /api/v1/transactions
// ==========================================

export async function POST(
  request: NextRequest
) {
  try {
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(
        auth.message,
        auth.status
      );
    }

    // --------------------------------------
    // VERIFY REQUEST ORIGIN
    // --------------------------------------

    const allowedOrigin =
      process.env.APP_ORIGIN ??
      (
        process.env.NODE_ENV ===
        "development"
          ? "http://localhost:3000"
          : ""
      );

    if (!allowedOrigin) {
      return jsonError(
        "APP_ORIGIN belum dikonfigurasi.",
        500
      );
    }

    if (
      request.headers.get("origin") !==
      allowedOrigin
    ) {
      return jsonError(
        "Origin request tidak diizinkan.",
        403
      );
    }

    // --------------------------------------
    // VERIFY CONTENT TYPE
    // --------------------------------------

    const contentType =
      request.headers.get(
        "content-type"
      ) ?? "";

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

    // --------------------------------------
    // PARSE REQUEST BODY
    // --------------------------------------

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

    const allowedFields = [
      "item_id",
      "transaction_type",
      "quantity",
      "notes",
    ];

    if (
      Object.keys(input).some(
        (key) =>
          !allowedFields.includes(key)
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

    // --------------------------------------
    // VALIDATE ITEM ID
    // --------------------------------------

    if (
      typeof itemId !== "string" ||
      !uuidRegex.test(itemId)
    ) {
      return jsonError(
        "ID barang tidak valid.",
        400
      );
    }

    // --------------------------------------
    // VALIDATE TRANSACTION TYPE
    // --------------------------------------

    if (
      typeof transactionType !==
        "string" ||
      !validTypes.includes(
        transactionType as TransactionType
      )
    ) {
      return jsonError(
        "Jenis transaksi tidak valid.",
        400
      );
    }

    // --------------------------------------
    // VALIDATE QUANTITY
    // --------------------------------------

    if (
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      return jsonError(
        "Jumlah transaksi harus lebih besar dari 0.",
        400
      );
    }

    // --------------------------------------
    // VALIDATE NOTES
    // --------------------------------------

    if (
      notes !== undefined &&
      notes !== null &&
      (
        typeof notes !== "string" ||
        notes.length > 500
      )
    ) {
      return jsonError(
        "Catatan maksimal 500 karakter.",
        400
      );
    }

    // --------------------------------------
    // CREATE STOCK TRANSACTION
    // --------------------------------------

    // Atomic stock updates and archived
    // item protection are handled by RPC.
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

      // Archived item
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

      // Insufficient stock
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

      // Missing item
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

      // Invalid transaction input
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

    // --------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------

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
