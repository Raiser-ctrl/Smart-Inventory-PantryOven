
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

// Validate account role
function isValidRole(role: unknown): role is UserRole {
  return role === "admin" || role === "staff";
}

// Validate account status
function isValidStatus(
  status: unknown
): status is AccountStatus {
  return (
    status === "active" ||
    status === "pending" ||
    status === "suspended"
  );
}

// Verify API access using authenticated profile
async function verifyApiAccess(
  allowedRoles: readonly UserRole[]
): Promise<ApiAuthResult> {
  try {
    const supabase = await createClient();

    // Verify authenticated user
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

    // Retrieve account role and status
    const { data: profile, error: profileError } =
      await supabase
        .from("profiles")
        .select("id, role, status")
        .eq("id", user.id)
        .single();

    // Reject database query failures
    if (profileError) {
      if (profileError.code === "PGRST116") {
        return {
          authorized: false,
          status: 403,
          message: "Account profile not found.",
        };
      }

      console.error(
        "API profile query failed:",
        profileError.message
      );

      return {
        authorized: false,
        status: 500,
        message: "Unable to verify account access.",
      };
    }

    // Reject missing profiles
    if (!profile) {
      return {
        authorized: false,
        status: 403,
        message: "Account profile not found.",
      };
    }

    // Validate profile integrity
    if (
      profile.id !== user.id ||
      !isValidRole(profile.role) ||
      !isValidStatus(profile.status)
    ) {
      return {
        authorized: false,
        status: 403,
        message: "Invalid account profile.",
      };
    }

    // Reject inactive accounts
    if (profile.status !== "active") {
      return {
        authorized: false,
        status: 403,
        message:
          profile.status === "pending"
            ? "Account is pending approval."
            : "Account is suspended.",
      };
    }

    // Verify allowed roles
    if (!allowedRoles.includes(profile.role)) {
      return {
        authorized: false,
        status: 403,
        message: "Forbidden.",
      };
    }

    // Return authorized account profile
    return {
      authorized: true,
      profile: {
        id: profile.id,
        role: profile.role,
        status: "active",
      },
    };
  } catch (error) {
   console.error(
  "[API Auth] Authorization failed:",
  error instanceof Error
    ? error.name
    : "unknown_error"
);

    return {
      authorized: false,
      status: 500,
      message: "Authorization failed.",
    };
  }
}

// Allow active Admin accounts only
export async function verifyApiAdmin(): Promise<ApiAuthResult> {
  return verifyApiAccess(["admin"]);
}

// Allow active Admin and Staff accounts
export async function verifyApiStaff(): Promise<ApiAuthResult> {
  return verifyApiAccess(["admin", "staff"]);
}
