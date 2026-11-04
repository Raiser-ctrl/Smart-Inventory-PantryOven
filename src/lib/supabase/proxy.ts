
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { performance } from "node:perf_hooks";

const shouldMeasurePerformance =
  process.env.PERF_DEBUG === "true";

/**
 * Refresh the Supabase authentication session
 * and synchronize cookies between request and response.
 *
 * Account authorization is handled separately
 * by server-side guards in lib/auth.ts.
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
          // Update cookies on the incoming request
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // Forward the updated request cookies
          response = NextResponse.next({
            request,
          });

          // Send refreshed cookies to the browser
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const startedAt = shouldMeasurePerformance
    ? performance.now()
    : 0;

  try {
    // Validate JWT claims and refresh the session if needed
    const { error } = await supabase.auth.getClaims();

    if (error && shouldMeasurePerformance) {
      console.warn(
        `[Performance] Proxy ${request.nextUrl.pathname} | ` +
          `Auth claims verification failed: ${error.message}`
      );
    }
  } finally {
    if (shouldMeasurePerformance) {
      const duration = Math.round(
        performance.now() - startedAt
      );

      console.info(
        `[Performance] Proxy ${request.nextUrl.pathname} | ` +
          `Auth getClaims: ${duration}ms`
      );
    }
  }

  return response;
}
