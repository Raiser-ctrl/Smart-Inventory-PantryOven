
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

const validTypes: TransactionType[] = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
];

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Return a consistent API error.
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

// Verify the authenticated admin.
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
      message: "Unauthorized. Silakan login terlebih dahulu.",
    };
  }

  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId) {
    console.error("ADMIN_USER_ID is missing");

    return {
      authorized: false,
      status: 500,
      message: "Konfigurasi admin belum lengkap.",
    };
  }

  if (user.id !== adminUserId) {
    return {
      authorized: false,
      status: 403,
      message: "Forbidden. Hanya admin yang dapat mengakses transaksi.",
    };
  }

  return { authorized: true };
}

// Escape LIKE wildcard characters.
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

// Fetch filtered and paginated transactions.
export async function GET(request: NextRequest) {
  try {
    // Verify admin access.
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    // Read query parameters.
    const params = request.nextUrl.searchParams;

    const search = (params.get("search") ?? "").trim();
    const type = params.get("type") ?? "all";
    const pageParam = params.get("page") ?? "1";
    const limitParam = params.get("limit") ?? "10";

    // Validate search parameters.
    if (search.length > 100) {
      return jsonError(
        "Pencarian maksimal 100 karakter.",
        400
      );
    }

    if (
      type !== "all" &&
      !validTypes.includes(type as TransactionType)
    ) {
      return jsonError(
        "Jenis transaksi tidak valid.",
        400
      );
    }

    // Validate pagination parameters.
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

    // Find inventory items matching the search.
    let matchingItemIds: string[] | null = null;

    if (search) {
      const safeSearch = escapeLike(search);

      const { data: items, error } = await supabaseAdmin
        .from("items")
        .select("id")
        .ilike("name", `%${safeSearch}%`);

      if (error) {
        console.error("Transaction search error:", {
          code: error.code,
          message: error.message,
        });

        return jsonError(
          "Gagal mencari barang.",
          500
        );
      }

      matchingItemIds = (items ?? []).map(
        (item) => item.id
      );
    }

    // Return empty results when no items match.
    if (matchingItemIds?.length === 0) {
      return NextResponse.json(
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
    }

    // Build the transaction query.
    let query = supabaseAdmin
      .from("stock_transactions")
      .select(
        "id, item_id, transaction_type, quantity, notes, created_at",
        { count: "exact" }
      );

    // Apply transaction type filter.
    if (type !== "all") {
      query = query.eq("transaction_type", type);
    }

    // Apply inventory item filter.
    if (matchingItemIds !== null) {
      query = query.in(
        "item_id",
        matchingItemIds
      );
    }

    // Calculate pagination range.
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Fetch the requested transaction page.
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

    // Collect item IDs from the current page.
    const itemIds = [
      ...new Set(
        (data ?? []).map(
          (transaction) => transaction.item_id
        )
      ),
    ];

    const itemMap = new Map<
      string,
      {
        name: string;
        unit: string;
      }
    >();

    // Fetch item details for displayed transactions.
    if (itemIds.length > 0) {
      const { data: items, error: itemsError } =
        await supabaseAdmin
          .from("items")
          .select("id, name, unit")
          .in("id", itemIds);

      if (itemsError) {
        console.error("Transaction items error:", {
          code: itemsError.code,
          message: itemsError.message,
        });

        return jsonError(
          "Gagal mengambil informasi barang.",
          500
        );
      }

      for (const item of items ?? []) {
        itemMap.set(item.id, {
          name: item.name,
          unit: item.unit,
        });
      }
    }

    // Combine transactions with item details.
    const transactions = (data ?? []).map(
      (transaction) => {
        const item = itemMap.get(
          transaction.item_id
        );

        return {
          ...transaction,
          quantity: Number(transaction.quantity),
          item_name: item?.name ?? "Unknown Item",
          unit: item?.unit ?? "",
        };
      }
    );

    // Return paginated transaction history.
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

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}

// Create a new stock transaction.
export async function POST(request: NextRequest) {
  try {
    // Verify admin access.
    const auth = await verifyAdmin();

    if (!auth.authorized) {
      return jsonError(auth.message, auth.status);
    }

    // Verify request origin.
    const allowedOrigin =
      process.env.APP_ORIGIN ??
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3000"
        : "");

    if (!allowedOrigin) {
      return jsonError(
        "APP_ORIGIN belum dikonfigurasi.",
        500
      );
    }

    const origin = request.headers.get("origin");

    if (origin !== allowedOrigin) {
      return jsonError(
        "Origin request tidak diizinkan.",
        403
      );
    }

    // Verify JSON content type.
    const contentType =
      request.headers.get("content-type") ?? "";

    if (
      !/^application\/json(?:\s*;|$)/i.test(contentType)
    ) {
      return jsonError(
        "Content-Type harus application/json.",
        415
      );
    }

    // Parse the request body.
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

    const itemId = input.item_id;
    const transactionType = input.transaction_type;
    const quantity = input.quantity;
    const notes = input.notes;

    // Validate the inventory item ID.
    if (
      typeof itemId !== "string" ||
      !uuidRegex.test(itemId)
    ) {
      return jsonError(
        "ID barang tidak valid.",
        400
      );
    }

    // Validate the transaction type.
    if (
      typeof transactionType !== "string" ||
      !validTypes.includes(
        transactionType as TransactionType
      )
    ) {
      return jsonError(
        "Jenis transaksi tidak valid.",
        400
      );
    }

    // Validate the transaction quantity.
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

    // Validate optional transaction notes.
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

    // Execute the atomic stock transaction.
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
      }
    );

    // Handle database transaction errors.
    if (error) {
      console.error("Transaction RPC error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

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

    // Return the created transaction.
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

    return jsonError(
      "Internal Server Error",
      500
    );
  }
}
