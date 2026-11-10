
import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",

    "/pending",
    "/suspended",
    "/unauthorized",

    "/dashboard/:path*",
    "/inventory/:path*",
    "/transactions/:path*",

    "/admin/:path*",
    "/profile/:path*",
    "/settings/:path*",

    "/api/v1/:path*",
  ],
};
