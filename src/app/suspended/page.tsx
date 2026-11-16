import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";

import { requireProfile } from "@/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function SuspendedPage() {
  // Verify the account status before showing this page
  const profile = await requireProfile();

  if (profile.status === "pending") {
    redirect("/pending");
  }

  if (profile.status === "active") {
    redirect("/dashboard");
  }

  return (
    <AuthShell
      illustration="suspended"
      title="Akses akun ditangguhkan"
      description="Hubungi administrator PantryOven untuk meminta peninjauan status akun."
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
          <p className="text-xs font-medium text-rose-800">Akun ditangguhkan</p>
          <p className="mt-1 break-words font-semibold [overflow-wrap:anywhere]">
            {profile.full_name?.trim() || "Pengguna PantryOven"}
          </p>
        </div>
        <LogoutButton />
      </div>
    </AuthShell>
  );
}
