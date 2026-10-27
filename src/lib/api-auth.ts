
import "server-only";

import { createClient } from "@/lib/supabase/server";

type AdminAuthResult =
  | { authorized: true }
  | {
      authorized: false;
      status: 401 | 403 | 500;
      message: string;
    };

export async function verifyApiAdmin(): Promise<AdminAuthResult> {
  const adminId = process.env.ADMIN_USER_ID;

  if (!adminId) {
    console.error("ADMIN_USER_ID is not configured.");

    return {
      authorized: false,
      status: 500,
      message: "Admin belum dikonfigurasi.",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      authorized: false,
      status: 401,
      message: "Unauthorized.",
    };
  }

  if (user.id !== adminId) {
    return {
      authorized: false,
      status: 403,
      message: "Forbidden.",
    };
  }

  return { authorized: true };
}
