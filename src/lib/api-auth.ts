
import "server-only";

import { createClient } from "@/lib/supabase/server";

import type {
  AccountStatus,
  UserRole,
} from "@/lib/auth";

type AuthorizedProfile = {
  id: string;
  role: UserRole;
  status: "active";
};

type ApiAuthResult =
  | {
      authorized: true;
      profile: AuthorizedProfile;
    }
  | {
      authorized: false;
      status: 401 | 403 | 500;
      message: string;
    };

async function verifyApiAccess(
  allowedRoles: UserRole[]
): Promise<ApiAuthResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        authorized: false,
        status: 401,
        message: "Unauthorized.",
      };
    }

    const { data: profile, error } =
      await supabase
        .from("profiles")
        .select("id, role, status")
        .eq("id", user.id)
        .single();

    if (error || !profile) {
      console.error(
        "API profile query failed:",
        error?.message
      );

      return {
        authorized: false,
        status: 403,
        message: "Account access unavailable.",
      };
    }

    const role = profile.role as UserRole;
    const status = profile.status as AccountStatus;

    if (status !== "active") {
      return {
        authorized: false,
        status: 403,
        message:
          status === "pending"
            ? "Account is pending approval."
            : "Account is not active.",
      };
    }

    if (!allowedRoles.includes(role)) {
      return {
        authorized: false,
        status: 403,
        message: "Forbidden.",
      };
    }

    return {
      authorized: true,
      profile: {
        id: profile.id,
        role,
        status: "active",
      },
    };
  } catch (error) {
    console.error(
      "API authorization error:",
      error
    );

    return {
      authorized: false,
      status: 500,
      message: "Authorization failed.",
    };
  }
}

// Admin-only endpoints
export async function verifyApiAdmin() {
  return verifyApiAccess(["admin"]);
}

// Operational endpoints
export async function verifyApiStaff() {
  return verifyApiAccess([
    "admin",
    "staff",
  ]);
}
