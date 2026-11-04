
"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type RegisterField =
  | "fullName"
  | "email"
  | "password"
  | "confirmPassword";

type RegisterErrors = Partial<
  Record<RegisterField, string>
>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [fieldErrors, setFieldErrors] =
    useState<RegisterErrors>({});
  const [errorMessage, setErrorMessage] = useState("");

  function clearFieldError(field: RegisterField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;

      const next = { ...current };
      delete next[field];

      return next;
    });

    setErrorMessage("");
  }

  function validateForm(): boolean {
    const errors: RegisterErrors = {};
    const name = fullName.trim();
    const normalizedEmail = email.trim();

    if (!name) {
      errors.fullName = "Nama lengkap wajib diisi.";
    } else if (name.length < 2 || name.length > 100) {
      errors.fullName = "Nama harus terdiri dari 2–100 karakter.";
    }

    if (!normalizedEmail) {
      errors.email = "Email wajib diisi.";
    } else if (
      normalizedEmail.length > 254 ||
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      errors.email = "Masukkan alamat email yang valid.";
    }

    if (!password) {
      errors.password = "Password wajib diisi.";
    } else if (password.length < 8) {
      errors.password = "Password minimal 8 karakter.";
    }

    if (!confirmPassword) {
      errors.confirmPassword =
        "Konfirmasi password wajib diisi.";
    } else if (password !== confirmPassword) {
      errors.confirmPassword =
        "Konfirmasi password tidak cocok.";
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setErrorMessage("");

    if (!validateForm()) return;

    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });

      if (error) {
        const message = error.message.toLowerCase();

        if (
          error.status === 429 ||
          message.includes("rate limit")
        ) {
          setErrorMessage(
            "Terlalu banyak percobaan pendaftaran. Tunggu beberapa saat sebelum mencoba lagi."
          );
        } else if (
          message.includes("password") ||
          message.includes("weak password")
        ) {
          setFieldErrors((current) => ({
            ...current,
            password:
              "Password tidak memenuhi persyaratan keamanan. Gunakan kombinasi yang lebih kuat.",
          }));
        } else if (
          message.includes("invalid email") ||
          message.includes("email address is invalid")
        ) {
          setFieldErrors((current) => ({
            ...current,
            email: "Alamat email tidak dapat digunakan.",
          }));
        } else {
          setErrorMessage(
            "Pendaftaran belum berhasil. Periksa kembali data kamu dan coba lagi."
          );
        }

        return;
      }

      // End any new signup session before waiting for approval
      if (data.session) {
        const { error: signOutError } =
          await supabase.auth.signOut({ scope: "local" });

        if (signOutError) {
          setErrorMessage(
            "Pendaftaran diproses, tetapi sesi belum berhasil ditutup. Silakan coba keluar dari akun."
          );
          return;
        }
      }

      setRegistered(true);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
      setShowConfirmPassword(false);
      setFieldErrors({});
    } catch {
      setErrorMessage(
        "Terjadi masalah saat menghubungi server. Silakan coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={registered ? "Almost there!" : "Let's get started!"}
      description={
        registered
          ? "Pendaftaran kamu sudah diproses. Selesaikan langkah berikutnya untuk mulai menggunakan PantryOven."
          : "Buat akun dan mulai kelola inventory bakery dengan lebih nyaman."
      }
    >
      {registered ? (
        <div className="space-y-5">
          {/* Registration success */}
          <div className="flex size-14 items-center justify-center rounded-2xl bg-[#e8f0e2] text-[#687c59]">
            <CheckCircle2
              aria-hidden="true"
              className="size-7"
            />
          </div>

          <div className="rounded-2xl border border-[#e8dfd4] bg-[#fdfbf8] p-5">
            <h2 className="font-semibold text-[#463a30]">
              Permintaan pendaftaran diterima
            </h2>

            <p className="mt-2 text-sm leading-7 text-[#796e61]">
              Jika email verifikasi dikirim, periksa inbox
              atau folder spam dan selesaikan verifikasi
              terlebih dahulu.
            </p>

            <p className="mt-3 text-sm leading-7 text-[#796e61]">
              Setelah login, akun baru akan menunggu
              persetujuan administrator sebelum dapat
              mengakses Dashboard.
            </p>
          </div>

          <Button asChild className="po-button w-full">
            <Link href="/login">
              Kembali ke Login
              <ArrowRight
                aria-hidden="true"
                className="ml-2 size-4"
              />
            </Link>
          </Button>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={handleRegister}
          className="space-y-4"
        >
          {/* Full name */}
          <div className="space-y-2">
            <Label
              htmlFor="fullName"
              className="text-[#594c40]"
            >
              Nama lengkap
            </Label>

            <div className="relative">
              <UserRound
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#a49788]"
              />

              <Input
                id="fullName"
                name="fullName"
                type="text"
                autoComplete="name"
                placeholder="Nama lengkap kamu"
                maxLength={100}
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  clearFieldError("fullName");
                }}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.fullName)}
                aria-describedby={
                  fieldErrors.fullName
                    ? "register-name-error"
                    : undefined
                }
                className="po-input pl-11"
              />
            </div>

            {fieldErrors.fullName && (
              <p
                id="register-name-error"
                role="alert"
                className="po-field-error"
              >
                {fieldErrors.fullName}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[#594c40]">
              Email
            </Label>

            <div className="relative">
              <Mail
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#a49788]"
              />

              <Input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="nama@email.com"
                maxLength={254}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  clearFieldError("email");
                }}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={
                  fieldErrors.email
                    ? "register-email-error"
                    : undefined
                }
                className="po-input pl-11"
              />
            </div>

            {fieldErrors.email && (
              <p
                id="register-email-error"
                role="alert"
                className="po-field-error"
              >
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[#594c40]">
              Password
            </Label>

            <div className="relative">
              <LockKeyhole
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#a49788]"
              />

              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  clearFieldError("password");
                  clearFieldError("confirmPassword");
                }}
                disabled={loading}
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={
                  fieldErrors.password
                    ? "register-password-error"
                    : undefined
                }
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
                className="absolute right-0 top-0 flex size-12 items-center justify-center rounded-r-2xl text-[#938574] transition-colors hover:text-[#463a30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#778766] disabled:opacity-50"
              >
                {showPassword ? (
                  <EyeOff
                    aria-hidden="true"
                    className="size-4"
                  />
                ) : (
                  <Eye
                    aria-hidden="true"
                    className="size-4"
                  />
                )}
              </button>
            </div>

            {fieldErrors.password && (
              <p
                id="register-password-error"
                role="alert"
                className="po-field-error"
              >
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="text-[#594c40]"
            >
              Konfirmasi password
            </Label>

            <div className="relative">
              <LockKeyhole
                aria-hidden="true"
                className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#a49788]"
              />

              <Input
                id="confirmPassword"
                name="confirmPassword"
                type={
                  showConfirmPassword ? "text" : "password"
                }
                autoComplete="new-password"
                placeholder="Ulangi password"
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  clearFieldError("confirmPassword");
                }}
                disabled={loading}
                aria-invalid={Boolean(
                  fieldErrors.confirmPassword
                )}
                aria-describedby={
                  fieldErrors.confirmPassword
                    ? "register-confirm-error"
                    : undefined
                }
                className="po-input pl-11 pr-12"
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
                className="absolute right-0 top-0 flex size-12 items-center justify-center rounded-r-2xl text-[#938574] transition-colors hover:text-[#463a30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#778766] disabled:opacity-50"
              >
                {showConfirmPassword ? (
                  <EyeOff
                    aria-hidden="true"
                    className="size-4"
                  />
                ) : (
                  <Eye
                    aria-hidden="true"
                    className="size-4"
                  />
                )}
              </button>
            </div>

            {fieldErrors.confirmPassword && (
              <p
                id="register-confirm-error"
                role="alert"
                className="po-field-error"
              >
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>

          {/* Account approval information */}
          <p className="text-xs leading-5 text-[#8a7b6b]">
            Akun baru akan berstatus Staff Pending
            sampai disetujui administrator.
          </p>

          {/* Registration error */}
          {errorMessage && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-[#f0d5d0] bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#a44942]"
            >
              {errorMessage}
            </div>
          )}

          {/* Submit button */}
          <Button
            type="submit"
            disabled={loading}
            className="po-button mt-2 w-full font-semibold"
          >
            {loading ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
                />
                Mendaftarkan...
              </>
            ) : (
              <>
                Buat Akun
                <ArrowRight
                  aria-hidden="true"
                  className="ml-2 size-4"
                />
              </>
            )}
          </Button>

          {/* Login link */}
          <p className="pt-2 text-center text-sm text-[#8a7b6b]">
            Sudah punya akun?{" "}
            <Link
              href="/login"
              className="font-bold text-[#617451] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#778766]"
            >
              Masuk sekarang
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
