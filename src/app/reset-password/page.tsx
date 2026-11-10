
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  ShieldAlert,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

type PageStatus =
  | "checking"
  | "ready"
  | "invalid"
  | "success";

export default function ResetPasswordPage() {
  const submittingRef = useRef(false);

  const [status, setStatus] =
    useState<PageStatus>("checking");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const supabase = createClient();

        const { data, error } =
          await supabase.auth.getUser();

        if (!active) return;

        if (error || !data.user) {
          setStatus("invalid");
          return;
        }

        setStatus("ready");
      } catch {
        if (active) {
          setStatus("invalid");
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submittingRef.current ||
      loading ||
      status !== "ready"
    ) {
      return;
    }

    setErrorMessage("");

    if (
      password.length < MIN_PASSWORD_LENGTH ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      setErrorMessage(
        "Password harus terdiri dari 8–128 karakter."
      );
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage(
        "Konfirmasi password tidak cocok."
      );
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const supabase = createClient();

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        setStatus("invalid");
        return;
      }

      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        if (
          error.status === 401 ||
          error.status === 403
        ) {
          setStatus("invalid");
          return;
        }

        setErrorMessage(
          error.code === "same_password"
            ? "Password baru harus berbeda dari password sebelumnya."
            : "Password gagal diperbarui. Periksa ketentuan password dan coba lagi."
        );
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);

      setStatus("success");

      // End the current browser session after
      // the password has been changed.
      const { error: signOutError } =
        await supabase.auth.signOut();

      if (signOutError) {
        console.error(
          "[Reset Password] Sign-out failed:",
          signOutError.code ?? "unknown_error"
        );
      }
    } catch {
      setErrorMessage(
        "Terjadi masalah saat menghubungi server. Silakan coba lagi."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  const title =
    status === "success"
      ? "Password berhasil diubah!"
      : status === "invalid"
        ? "Sesi tidak tersedia"
        : "Buat password baru";

  const description =
    status === "success"
      ? "Password akun PantryOven kamu sudah diperbarui."
      : status === "invalid"
        ? "Silakan buka link reset password yang valid."
        : "Gunakan password baru yang kuat untuk melindungi akun kamu.";

  return (
    <AuthShell
      title={title}
      description={description}
    >
      {status === "checking" ? (
        <div
          role="status"
          className="flex flex-col items-center gap-3 py-8 text-center"
        >
          <Loader2
            aria-hidden="true"
            className="size-8 animate-spin text-[#617451]"
          />
          <p className="text-sm text-[#8a7b6b]">
            Memeriksa sesi akun...
          </p>
        </div>
      ) : status === "success" ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#e8efe2]">
            <CheckCircle2
              aria-hidden="true"
              className="size-7 text-[#617451]"
            />
          </div>

          <p className="text-sm leading-6 text-[#8a7b6b]">
            Password berhasil diperbarui.
            Silakan login menggunakan password baru.
          </p>

          <Button
            asChild
            className="po-button w-full font-semibold"
          >
            <Link href="/login">
              <ArrowLeft className="mr-2 size-4" />
              Kembali ke Login
            </Link>
          </Button>
        </div>
      ) : status === "invalid" ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#fff0eb]">
            <ShieldAlert
              aria-hidden="true"
              className="size-7 text-[#b36b52]"
            />
          </div>

          <p
            role="alert"
            className="text-sm leading-6 text-[#a44942]"
          >
            Tidak ditemukan sesi Supabase yang valid.
            Silakan minta link reset password baru.
          </p>

          <Button
            asChild
            className="po-button w-full font-semibold"
          >
            <Link href="/forgot-password">
              Minta Link Reset Baru
            </Link>
          </Button>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#617451] hover:underline"
          >
            <ArrowLeft className="size-4" />
            Kembali ke Login
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(event) =>
            void handleSubmit(event)
          }
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label
              htmlFor="password"
              className="text-[#594c40]"
            >
              Password Baru
            </Label>

            <div className="relative">
              <LockKeyhole
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#a49788]"
              />

              <Input
                id="password"
                name="password"
                type={
                  showPassword ? "text" : "password"
                }
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                required
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrorMessage("");
                }}
                disabled={loading}
                className="po-input pl-11 pr-12"
              />

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setShowPassword((current) => !current)
                }
                aria-label={
                  showPassword
                    ? "Sembunyikan password"
                    : "Tampilkan password"
                }
                aria-pressed={showPassword}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-[#938574] hover:text-[#463a30] disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label
              htmlFor="confirm-password"
              className="text-[#594c40]"
            >
              Konfirmasi Password
            </Label>

            <div className="relative">
              <Input
                id="confirm-password"
                name="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                autoComplete="new-password"
                placeholder="Ulangi password baru"
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={MAX_PASSWORD_LENGTH}
                required
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setErrorMessage("");
                }}
                disabled={loading}
                className="po-input pr-12"
              />

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setShowConfirmPassword(
                    (current) => !current
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? "Sembunyikan konfirmasi password"
                    : "Tampilkan konfirmasi password"
                }
                aria-pressed={showConfirmPassword}
                className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-[#938574] hover:text-[#463a30]"
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="rounded-xl border border-[#f0d5d0] bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#a44942]"
            >
              {errorMessage}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="po-button w-full font-semibold"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan Password Baru"
            )}
          </Button>

          <div className="text-center">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-[#617451] hover:underline"
            >
              Minta link reset baru
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
