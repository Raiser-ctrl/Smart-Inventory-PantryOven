
import { NextRequest, NextResponse } from "next/server";

import { verifyApiAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type TargetStatus = "active" | "suspended";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  // Verify admin access
  const auth = await verifyApiAdmin();

  if (!auth.authorized) {
    return NextResponse.json(
      {
        status: "failed",
        message: auth.message,
      },
      { status: auth.status }
    );
  }

  const { id } = await context.params;

  // Validate user ID
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json(
      {
        status: "failed",
        message: "ID pengguna tidak valid.",
      },
      { status: 400 }
    );
  }

  // Prevent admin from modifying their own account
  if (id === auth.profile.id) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Tidak dapat mengubah status akun sendiri.",
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

  // Validate requested status
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body) ||
    !("status" in body) ||
    (body.status !== "active" &&
      body.status !== "suspended")
  ) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Status harus active atau suspended.",
      },
      { status: 400 }
    );
  }

  const nextStatus: TargetStatus = body.status;

  // Retrieve target user
  const { data: target, error: targetError } =
    await supabaseAdmin
      .from("profiles")
      .select("id, role, status")
      .eq("id", id)
      .single();

  if (targetError || !target) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Pengguna tidak ditemukan.",
      },
      { status: 404 }
    );
  }

  // Protect admin accounts
  if (target.role !== "staff") {
    return NextResponse.json(
      {
        status: "failed",
        message: "Status akun Admin tidak dapat diubah.",
      },
      { status: 403 }
    );
  }

  if (
    target.status !== "pending" &&
    target.status !== "active" &&
    target.status !== "suspended"
  ) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Status akun tidak valid.",
      },
      { status: 409 }
    );
  }

  // Return early when status is unchanged
  if (target.status === nextStatus) {
    return NextResponse.json({
      status: "success",
      message: "Status akun tidak berubah.",
      data: target,
    });
  }

  // Update only if target state has not changed
  const { data: updated, error: updateError } =
    await supabaseAdmin
      .from("profiles")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("role", "staff")
      .eq("status", target.status)
      .select("id, full_name, role, status, updated_at")
      .maybeSingle();

  if (updateError) {
    console.error(
      "Failed to update user status:",
      updateError.message
    );

    return NextResponse.json(
      {
        status: "failed",
        message: "Gagal memperbarui status pengguna.",
      },
      { status: 500 }
    );
  }

  if (!updated) {
    return NextResponse.json(
      {
        status: "failed",
        message:
          "Status akun sudah berubah. Muat ulang daftar pengguna.",
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    status: "success",
    message:
      nextStatus === "active"
        ? "Akun berhasil diaktifkan."
        : "Akun berhasil ditangguhkan.",
    data: updated,
  });
}
