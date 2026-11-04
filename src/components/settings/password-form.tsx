
"use client";

import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: "current-password" | "new-password";
  disabled: boolean;
  description?: string;
  invalid?: boolean;
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  disabled,
  description,
  invalid = false,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="min-w-0 space-y-2">
      <label
        htmlFor={id}
        className="text-sm font-medium"
      >
        {label}
      </label>

      <div className="relative min-w-0">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
          autoComplete={autoComplete}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={
            description ? `${id}-help` : undefined
          }
          className="
            h-11 w-full min-w-0 rounded-xl pr-12
            [&::-ms-reveal]:hidden
            [&::-ms-clear]:hidden
          "
        />

        <button
          type="button"
          disabled={disabled}
          aria-label={
            visible
              ? `Sembunyikan ${label.toLowerCase()}`
              : `Tampilkan ${label.toLowerCase()}`
          }
          aria-pressed={visible}
          onClick={() =>
            setVisible((current) => !current)
          }
          className="
            absolute inset-y-0 right-1
            flex w-10 items-center justify-center
            rounded-lg text-muted-foreground
            transition-colors
            hover:text-foreground
            focus-visible:outline-none
            focus-visible:ring-2
            focus-visible:ring-ring
            disabled:pointer-events-none
            disabled:opacity-50
          "
        >
          {visible ? (
            <EyeOff
              aria-hidden="true"
              className="size-[18px]"
            />
          ) : (
            <Eye
              aria-hidden="true"
              className="size-[18px]"
            />
          )}
        </button>
      </div>

      {description && (
        <p
          id={`${id}-help`}
          className="text-xs leading-5 text-muted-foreground"
        >
          {description}
        </p>
      )}
    </div>
  );
}

export function PasswordForm() {
  const [currentPassword, setCurrentPassword] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const hasMinimumLength =
    newPassword.length >= 8;

  const passwordsMatch =
    confirmPassword.length > 0 &&
    newPassword === confirmPassword;

  const isDifferent =
    newPassword.length > 0 &&
    newPassword !== currentPassword;

  const isValid =
    currentPassword.length > 0 &&
    hasMinimumLength &&
    passwordsMatch &&
    isDifferent;

  function clearFeedback() {
    setErrorMessage("");
    setSuccessMessage("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (saving) return;

    clearFeedback();

    if (!currentPassword) {
      setErrorMessage(
        "Masukkan password saat ini."
      );
      return;
    }

    if (!hasMinimumLength) {
      setErrorMessage(
        "Password baru minimal 8 karakter."
      );
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage(
        "Konfirmasi password tidak cocok."
      );
      return;
    }

    if (!isDifferent) {
      setErrorMessage(
        "Password baru harus berbeda dari password lama."
      );
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();

      // Get authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.email) {
        throw new Error(
          "Sesi tidak valid. Silakan login kembali."
        );
      }

      // Verify current password
      const { error: verifyError } =
        await supabase.auth.signInWithPassword({
          email: user.email,
          password: currentPassword,
        });

      if (verifyError) {
        throw new Error(
          "Password saat ini tidak sesuai."
        );
      }

      // Update password
      const { error: updateError } =
        await supabase.auth.updateUser({
          password: newPassword,
        });

      if (updateError) {
        throw new Error(
          updateError.message
        );
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setSuccessMessage(
        "Password berhasil diperbarui."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal memperbarui password."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) =>
        void handleSubmit(event)
      }
      className="min-w-0 max-w-xl space-y-5"
    >
      {/* Current password */}
      <PasswordField
        id="current-password"
        label="Current Password"
        value={currentPassword}
        onChange={(value) => {
          setCurrentPassword(value);
          clearFeedback();
        }}
        placeholder="Masukkan password saat ini"
        autoComplete="current-password"
        disabled={saving}
      />

      {/* New password */}
      <PasswordField
        id="new-password"
        label="New Password"
        value={newPassword}
        onChange={(value) => {
          setNewPassword(value);
          clearFeedback();
        }}
        placeholder="Minimal 8 karakter"
        autoComplete="new-password"
        disabled={saving}
        invalid={
          newPassword.length > 0 &&
          !hasMinimumLength
        }
        description="Gunakan minimal 8 karakter. Kombinasi huruf, angka, dan simbol lebih disarankan."
      />

      {/* Confirm password */}
      <PasswordField
        id="confirm-password"
        label="Confirm New Password"
        value={confirmPassword}
        onChange={(value) => {
          setConfirmPassword(value);
          clearFeedback();
        }}
        placeholder="Ulangi password baru"
        autoComplete="new-password"
        disabled={saving}
        invalid={
          confirmPassword.length > 0 &&
          !passwordsMatch
        }
      />

      {/* Error feedback */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
        >
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0">
            {errorMessage}
          </span>
        </div>
      )}

      {/* Success feedback */}
      {successMessage && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400"
        >
          <CheckCircle2
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <span className="min-w-0">
            {successMessage}
          </span>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end border-t pt-5">
        <Button
          type="submit"
          disabled={!isValid || saving}
          className="h-10 w-full rounded-xl bg-[#687c59] text-white hover:bg-[#56694a] sm:w-auto"
        >
          {saving && (
            <Loader2
              aria-hidden="true"
              className="mr-2 size-4 animate-spin"
            />
          )}

          {saving
            ? "Updating..."
            : "Update Password"}
        </Button>
      </div>
    </form>
  );
}
