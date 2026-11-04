
import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { performance } from "node:perf_hooks";

import { createClient } from "@/lib/supabase/server";

export type UserRole = "admin" | "staff";

export type AccountStatus =
  | "pending"
  | "active"
  | "suspended";

export type UserProfile = {
  id: string;
  full_name: string;
  avatar_path: string | null;
  role: UserRole;
  status: AccountStatus;
  created_at: string;
  updated_at: string;
};

const shouldMeasurePerformance =
  process.env.NODE_ENV === "development" ||
  process.env.PERF_DEBUG === "true";

function logPerformance(label: string, startedAt: number) {
  if (!shouldMeasurePerformance) return;

  console.info(
    `[Performance] ${label}: ${Math.round(
      performance.now() - startedAt
    )}ms`
  );
}

// Require an authenticated Supabase user
export const requireUser = cache(async () => {
  const startedAt = performance.now();

  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  logPerformance("Auth requireUser total", startedAt);

  return user;
});

// Retrieve the current user's profile
export const requireProfile = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, full_name, avatar_path, role, status, created_at, updated_at"
    )
    .eq("id", user.id)
    .single();

  if (error || !data) {
    console.error(
      "Failed to load user profile:",
      error?.message
    );

    redirect("/unauthorized");
  }

  return data as UserProfile;
});

// Allow active accounts only
export async function requireApprovedUser() {
  const profile = await requireProfile();

  if (profile.status === "pending") {
    redirect("/pending");
  }

  if (profile.status === "suspended") {
    redirect("/suspended");
  }

  if (profile.status !== "active") {
    redirect("/unauthorized");
  }

  return profile;
}

// Allow active administrators only
export async function requireAdmin() {
  const profile = await requireApprovedUser();

  if (profile.role !== "admin") {
    redirect("/unauthorized");
  }

  return profile;
}
