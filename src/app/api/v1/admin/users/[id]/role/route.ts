
import { NextRequest, NextResponse } from "next/server";

import { verifyApiAdmin } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UserRole = "admin" | "staff";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ERROR_MESSAGES: Record<string, {
  status: number;
  message: string;
}> = {
  UNAUTHORIZED: {
    status: 401,
    message: "Silakan login kembali.",
  },
  ADMIN_REQUIRED: {
    status: 403,
    message: "Hanya Admin aktif yang dapat mengubah role.",
  },
  SELF_ROLE_CHANGE_FORBIDDEN: {
    status: 403,
    message: "Tidak dapat mengubah role sendiri.",
  },
  INVALID_ROLE: {
    status: 400,
    message: "Role tidak valid.",
  },
  INVALID_TARGET: {
    status: 400,
    message: "ID pengguna tidak valid.",
  },
  USER_NOT_FOUND: {
    status: 404,
    message: "Pengguna tidak ditemukan.",
  },
  TARGET_MUST_BE_ACTIVE: {
    status: 409,
    message: "Aktifkan akun Staff sebelum menjadikannya Admin.",
  },
  LAST_ACTIVE_ADMIN: {
    status: 409,
    message: "Admin aktif terakhir tidak boleh diturunkan.",
  },
  INVALID_PROFILE_STATE: {
    status: 409,
    message: "Kondisi akun pengguna tidak valid.",
  },
};

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const auth = await verifyApiAdmin();

  if (!auth.authorized) {
    return NextResponse.json(
      { status: "failed", message: auth.message },
      { status: auth.status }
    );
  }

  const { id } = await context.params;

  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      {
        status: "failed",
        message: "ID pengguna tidak valid.",
      },
      { status: 400 }
    );
  }

  if (id === auth.profile.id) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Tidak dapat mengubah role sendiri.",
      },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        status: "failed",
        message: "Format JSON tidak valid.",
      },
      { status: 400 }
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("role" in body) ||
    (body.role !== "admin" && body.role !== "staff")
  ) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Role harus admin atau staff.",
      },
      { status: 400 }
    );
  }

  const nextRole: UserRole = body.role;

  try {
    // Gunakan sesi pengguna, bukan service-role client.
    // auth.uid() harus tetap mengidentifikasi Admin pemanggil.
    const supabase = await createClient();

    const { data, error } = await supabase.rpc(
      "change_user_role",
      {
        p_target_id: id,
        p_new_role: nextRole,
      }
    );

    if (error) {
      const knownError = ERROR_MESSAGES[error.message];

      if (knownError) {
        return NextResponse.json(
          {
            status: "failed",
            message: knownError.message,
          },
          { status: knownError.status }
        );
      }

      console.error("Role update failed:", error.message);

      return NextResponse.json(
        {
          status: "failed",
          message: "Gagal memperbarui role pengguna.",
        },
        { status: 500 }
      );
    }

    const updated = Array.isArray(data) ? data[0] : null;

    if (!updated) {
      return NextResponse.json(
        {
          status: "failed",
          message: "Hasil perubahan role tidak valid.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "success",
      message:
        nextRole === "admin"
          ? "Pengguna berhasil dijadikan Admin."
          : "Admin berhasil diubah menjadi Staff.",
      data: updated,
    });
  } catch (error) {
    console.error("Unexpected role update error:", error);

    return NextResponse.json(
      {
        status: "failed",
        message: "Terjadi kesalahan pada server.",
      },
      { status: 500 }
    );
  }
}
