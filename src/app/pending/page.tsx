
import { redirect } from "next/navigation";
import { Clock3, ShieldCheck } from "lucide-react";

import { requireProfile } from "@/lib/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const profile = await requireProfile();

  // Redirect berdasarkan status akun
  if (profile.status === "active") {
    redirect("/dashboard");
  }

  if (profile.status !== "pending") {
    redirect("/unauthorized");
  }

  const displayName =
    profile.full_name?.trim() || "Pengguna PantryOven";

  return (
    <AuthShell
      title="Almost there."
      description="Sedikit lagi sebelum kamu bisa mulai menggunakan PantryOven."
    >
      <div className="space-y-6">
        {/* Account status */}
        <div className="rounded-[22px] border border-[#e8dfd4] bg-[#fdfbf8] p-5 sm:p-6">
          <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-[#f3e5d1] text-[#a77c4e]">
            <Clock3
              aria-hidden="true"
              className="size-6"
            />
          </div>

          <h2 className="text-lg font-semibold tracking-tight text-[#463a30]">
            Menunggu Persetujuan
          </h2>

          <p className="mt-3 text-sm leading-7 text-[#827466]">
            Halo,{" "}
            <span className="font-semibold text-[#463a30]">
              {displayName}
            </span>
            ! Akun kamu sedang ditinjau oleh Admin.
            Kamu akan mendapatkan akses setelah
            akun disetujui.
          </p>

          <div className="mt-5 flex items-center gap-2 border-t border-[#e8dfd4] pt-4">
            <ShieldCheck
              aria-hidden="true"
              className="size-4 text-[#778766]"
            />

            <span className="text-xs font-medium text-[#778766]">
              Pending Approval
            </span>
          </div>
        </div>

        {/* Next step */}
        <p className="px-1 text-center text-sm leading-6 text-[#827466]">
          Hubungi Admin jika kamu membutuhkan bantuan
          terkait aktivasi akun.
        </p>

        {/* Logout */}
        <LogoutButton
          variant="outline"
          className="h-12 w-full rounded-[14px] border-[#e8dfd4] bg-white text-[#594c40] hover:bg-[#f5eee5] hover:text-[#463a30]"
        />
      </div>
    </AuthShell>
  );
}
