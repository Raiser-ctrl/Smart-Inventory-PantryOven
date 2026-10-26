
import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId) {
    throw new Error("ADMIN_USER_ID belum dikonfigurasi");
  }

  if (user.id !== adminUserId) {
    redirect("/unauthorized");
  }

  return user;
}
