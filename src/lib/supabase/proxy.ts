
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { performance } from "node:perf_hooks";

/**
 * Refresh Supabase authentication session
 * and synchronize cookies between request and response.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase environment variables are missing."
    );
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          // Synchronize updated cookies with the request.
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Create a response with updated request cookies.
          response = NextResponse.next({
            request,
          });

          // Send refreshed cookies back to the browser.
          cookiesToSet.forEach(
            ({ name, value, options }) => {
              response.cookies.set(name, value, options);
            }
          );
        },
      },
    }
  );

  const startedAt = performance.now();

  try {
    // Verify JWT claims and refresh the session if needed.
    const { error } = await supabase.auth.getClaims();

    if (error && process.env.PERF_DEBUG === "true") {
      console.warn(
        `[Performance] Proxy ${request.nextUrl.pathname} | Auth claims verification failed: ${error.message}`
      );
    }
  } finally {
    if (process.env.PERF_DEBUG === "true") {
      const duration = Math.round(
        performance.now() - startedAt
      );

      console.info(
        `[Performance] Proxy ${request.nextUrl.pathname} | Auth getClaims: ${duration}ms`
      );
    }
  }

  return response;
}
