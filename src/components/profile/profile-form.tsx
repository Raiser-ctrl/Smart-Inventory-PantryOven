
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type UserRole = "admin" | "staff";

type ProfileFormProps = {
  initialName: string;
  role: UserRole;
};

type UpdateProfileResponse = {
  status: string;
  message?: string;
  data?: {
    full_name: string;
  };
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function ProfileForm({
  initialName,
  role,
}: ProfileFormProps) {
  const router = useRouter();

  const [fullName, setFullName] = useState(initialName || "");
  const [savedName, setSavedName] = useState(
    normalizeName(initialName || "")
  );

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const normalizedName = normalizeName(fullName);
  const hasChanges = normalizedName !== savedName;
  const isValid =
    normalizedName.length >= 2 &&
    normalizedName.length <= 80;

  const initials =
    savedName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "";

  const roleLabel = role === "admin" ? "Administrator" : "Staff";

  function handleReset() {
    setFullName(savedName);
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid || !hasChanges || saving) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const response = await fetch("/api/v1/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: normalizedName,
        }),
      });

      const result: UpdateProfileResponse = await response.json();

      if (!response.ok || result.status !== "success") {
        throw new Error(
          result.message || "Gagal menyimpan perubahan profil."
        );
      }

      const updatedName = normalizeName(
        result.data?.full_name || normalizedName
      );

      setFullName(updatedName);
      setSavedName(updatedName);
      setSuccessMessage("Perubahan profil berhasil disimpan.");

      // Refresh server-rendered account information
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan profil."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start lg:gap-6">
      {/* Account identity */}
      <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
        <div className="h-20 bg-gradient-to-r from-[#e7eee2] via-[#f0f4ed] to-[#f8faf6] dark:from-[#283427] dark:via-[#222d22] dark:to-background" />

        <div className="-mt-9 px-5 pb-5">
          <div className="flex size-[72px] items-center justify-center rounded-2xl border-4 border-card bg-[#edf2e9] text-xl font-bold text-[#526b47] shadow-sm">
            {initials || (
              <UserRound
                aria-hidden="true"
                className="size-7"
              />
            )}
          </div>

          <div className="mt-4 min-w-0">
            <h2 className="break-words text-lg font-semibold tracking-tight">
              {savedName || "Pengguna PantryOven"}
            </h2>

            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#dce6d6] bg-[#f3f7f0] px-2.5 py-1 text-xs font-medium text-[#617451] dark:border-[#455843] dark:bg-[#293729] dark:text-[#b7cba9]">
              <ShieldCheck
                aria-hidden="true"
                className="size-3.5"
              />
              {roleLabel}
            </div>
          </div>
        </div>
      </section>

      {/* Personal information */}
      <section className="min-w-0 overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-5 sm:px-6">
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">
            Personal Information
          </h2>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Perbarui informasi yang ditampilkan pada akun kamu.
          </p>
        </div>

        <form onSubmit={(event) => void handleSave(event)}>
          <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
            <div className="max-w-xl space-y-2">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="profile-full-name"
                  className="text-sm font-medium"
                >
                  Full Name
                </label>

                {hasChanges && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                    <span className="size-1.5 rounded-full bg-current" />
                    Unsaved changes
                  </span>
                )}
              </div>

              <Input
                id="profile-full-name"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
                placeholder="Masukkan nama lengkap"
                autoComplete="name"
                maxLength={80}
                disabled={saving}
                aria-invalid={fullName.length > 0 && !isValid}
                aria-describedby="profile-name-help"
                className="h-11 rounded-xl"
              />

              <p
                id="profile-name-help"
                className="text-xs leading-5 text-muted-foreground"
              >
                Gunakan nama lengkap dengan panjang 2–80 karakter.
              </p>
            </div>

            {/* Save feedback */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
              >
                <AlertCircle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
              >
                <CheckCircle2
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0">{successMessage}</span>
              </div>
            )}
          </div>

          {/* Form actions */}
          <div className="flex flex-col-reverse gap-2 border-t bg-muted/20 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Check
                aria-hidden="true"
                className="size-3.5 text-[#687c59]"
              />
              Informasi tersimpan dengan aman
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                disabled={!hasChanges || saving}
                onClick={handleReset}
                className="h-10 w-full gap-2 rounded-xl sm:w-auto"
              >
                <RotateCcw
                  aria-hidden="true"
                  className="size-4"
                />
                Reset
              </Button>

              <Button
                type="submit"
                disabled={!hasChanges || !isValid || saving}
                className="h-10 w-full gap-2 rounded-xl bg-[#687c59] text-white hover:bg-[#56694a] sm:w-auto"
              >
                {saving ? (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin"
                  />
                ) : (
                  <Check
                    aria-hidden="true"
                    className="size-4"
                  />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </section>
    </div>
  );
}
