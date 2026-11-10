
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = url.origin;

  const code = url.searchParams.get("code");
  const authError = url.searchParams.get("error");

  function failure(error: string) {
    const target = new URL("/forgot-password", origin);
    target.searchParams.set("error", error);

    const result = NextResponse.redirect(target);
    result.headers.set("Cache-Control", "no-store");

    return result;
  }

  if (authError || !code) {
    return failure("invalid_link");
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[Auth Callback] Missing Supabase configuration."
    );
    return failure("server_error");
  }

  const destination = new URL(
    "/reset-password",
    origin
  );

  const response = NextResponse.redirect(destination);

  response.headers.set("Cache-Control", "no-store");

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(
                name,
                value,
                options
              );
            }
          );
        },
      },
    }
  );

  try {
    const { data, error } =
      await supabase.auth.exchangeCodeForSession(
        code
      );

    if (error || !data.user) {
      console.error(
        "[Auth Callback] Exchange failed:",
        error?.code ?? "missing_user"
      );

      return failure("invalid_link");
    }

    // The PKCE code has been exchanged for
    // an authenticated Supabase session.
    //
    // This does not independently prove that
    // the code was issued for password recovery.
    //
    // No custom recovery token is created.

    return response;
  } catch (error) {
    console.error(
      "[Auth Callback] Unexpected error:",
      error instanceof Error
        ? error.name
        : "unknown_error"
    );

    return failure("server_error");
  }
}
