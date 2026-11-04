
import { NextResponse } from "next/server";

import { verifyApiAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
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

  // Retrieve user profiles
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, full_name, role, status, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Failed to fetch users:", error.message);

    return NextResponse.json(
      {
        status: "failed",
        message: "Gagal mengambil daftar pengguna.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status: "success",
    data: data ?? [],
  });
}
