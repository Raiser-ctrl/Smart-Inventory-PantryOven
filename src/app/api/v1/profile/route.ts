
import { NextResponse } from "next/server";

import { verifyApiStaff } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function PATCH(request: Request) {
  const auth = await verifyApiStaff();

  if (!auth.authorized) {
    return NextResponse.json(
      {
        status: "failed",
        message: auth.message,
      },
      { status: auth.status }
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
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !("full_name" in body) ||
    typeof body.full_name !== "string"
  ) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Nama lengkap wajib diisi.",
      },
      { status: 400 }
    );
  }

  const fullName = body.full_name.trim().replace(/\s+/g, " ");

  if (fullName.length < 2 || fullName.length > 80) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Nama lengkap harus terdiri dari 2–80 karakter.",
      },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name: fullName,
      updated_at: new Date().toISOString(),
    })
    .eq("id", auth.profile.id)
    .select("id, full_name, avatar_path, role, status")
    .single();

  if (error || !data) {
    return NextResponse.json(
      {
        status: "failed",
        message: "Gagal memperbarui profil.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "success",
    message: "Profil berhasil diperbarui.",
    data,
  });
}
