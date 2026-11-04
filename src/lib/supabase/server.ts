
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Supabase environment variables are missing"
    );
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },

        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch (error) {
            // Server Components may not allow
            // cookie writes during rendering.
            // The proxy must refresh sessions.

            if (process.env.NODE_ENV === "development") {
              console.debug(
                "[Supabase SSR] Cookie write skipped:",
                error instanceof Error
                  ? error.message
                  : "Unknown error"
              );
            }
          }
        },
      },
    }
  );
}
