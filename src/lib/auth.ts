
import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { performance } from "node:perf_hooks";

import { createClient } from "@/lib/supabase/server";

const shouldMeasurePerformance =
  process.env.NODE_ENV === "development" ||
  process.env.PERF_DEBUG === "true";

export const requireUser = cache(async () => {
  const authStartedAt = performance.now();

  // Create Supabase server client.
  const clientStartedAt = performance.now();

  const supabase = await createClient();

  if (shouldMeasurePerformance) {
    console.info(
      `[Performance] Auth createClient: ${Math.round(
        performance.now() - clientStartedAt
      )}ms`
    );
  }

  // Verify the authenticated user.
  const userStartedAt = performance.now();

  let authResult;

  try {
    authResult = await supabase.auth.getUser();
  } finally {
    if (shouldMeasurePerformance) {
      console.info(
        `[Performance] Dashboard Auth getUser: ${Math.round(
          performance.now() - userStartedAt
        )}ms`
      );
    }
  }

  const {
    data: { user },
    error,
  } = authResult;

  if (shouldMeasurePerformance) {
    console.info(
      `[Performance] Auth requireUser total: ${Math.round(
        performance.now() - authStartedAt
      )}ms`
    );
  }

  if (error || !user) {
    redirect("/login");
  }

  return user;
});

export async function requireAdmin() {
  const startedAt = performance.now();

  const user = await requireUser();

  const adminUserId = process.env.ADMIN_USER_ID;

  if (!adminUserId) {
    throw new Error(
      "ADMIN_USER_ID belum dikonfigurasi."
    );
  }

  if (user.id !== adminUserId) {
    redirect("/unauthorized");
  }

  if (shouldMeasurePerformance) {
    console.info(
      `[Performance] Auth requireAdmin total: ${Math.round(
        performance.now() - startedAt
      )}ms`
    );
  }

  return user;
}
