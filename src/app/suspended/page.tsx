
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

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
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-10 sm:px-6">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-7 flex items-center justify-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#edf2e9] text-[#617451]">
            <ShieldCheck
              aria-hidden="true"
              className="size-5"
            />
          </div>

          <span className="text-lg font-bold tracking-tight">
            PantryOven
          </span>
        </div>

        {/* Suspended account card */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="px-5 pb-6 pt-8 text-center sm:px-8 sm:pt-9">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400">
              <ShieldAlert
                aria-hidden="true"
                className="size-8"
              />
            </div>

            <div className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              <span className="size-1.5 rounded-full bg-current" />
              Account Suspended
            </div>

            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              Akses akun ditangguhkan
            </h1>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Akun PantryOven kamu sedang ditangguhkan.
              Untuk sementara, kamu tidak dapat mengakses
              Dashboard dan fitur pengelolaan inventory.
            </p>
          </div>

          <div className="mx-5 rounded-xl border bg-muted/30 p-4 sm:mx-8">
            <p className="text-xs font-medium text-muted-foreground">
              Informasi akun
            </p>

            <p className="mt-2 break-words text-sm font-semibold">
              {profile.full_name?.trim() || "Pengguna PantryOven"}
            </p>

            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Hubungi administrator PantryOven untuk
              meminta peninjauan status akun.
            </p>
          </div>

          <div className="px-5 pb-7 pt-5 sm:px-8">
            <LogoutButton />

            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <ArrowRight
                aria-hidden="true"
                className="size-3.5"
              />
              Akses akan tersedia kembali setelah akun diaktifkan.
            </p>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          PantryOven · Account Access
        </p>
      </div>
    </main>
  );
}
