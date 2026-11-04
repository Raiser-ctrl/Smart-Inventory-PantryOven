
import { LockKeyhole } from "lucide-react";

import { requireApprovedUser } from "@/lib/auth";
import { PasswordForm } from "@/components/settings/password-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // Allow active authenticated users only
  await requireApprovedUser();

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      {/* Page heading */}
      <header className="mb-5 sm:mb-6">
        <p className="mb-2 text-sm font-medium text-[#617451]">
          Account
        </p>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Settings
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Kelola keamanan dan pengaturan akun PantryOven kamu.
        </p>
      </header>

      {/* Account security */}
      <section className="max-w-4xl overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-start gap-3 border-b px-4 py-5 sm:gap-4 sm:px-6 sm:py-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#edf2e9] text-[#617451] dark:bg-[#293729] dark:text-[#b7cba9]">
            <LockKeyhole
              aria-hidden="true"
              className="size-5"
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              Account Security
            </h2>

            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Perbarui password untuk menjaga keamanan akun kamu.
            </p>
          </div>
        </div>

        {/* Password management */}
        <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
