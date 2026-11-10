
"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  Mail,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginField = "email" | "password";

type LoginErrors = Partial<
  Record<LoginField, string>
>;

type UserRole = "admin" | "staff";

type AccountStatus =
  | "pending"
  | "active"
  | "suspended";

type LoginProfile = {
  role: UserRole;
  status: AccountStatus;
};

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_EMAIL_LENGTH = 254;

function isLoginProfile(
  value: unknown
): value is LoginProfile {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const profile = value as Record<
    string,
    unknown
  >;

  const validRole =
    profile.role === "admin" ||
    profile.role === "staff";

  const validStatus =
    profile.status === "pending" ||
    profile.status === "active" ||
    profile.status === "suspended";

  return validRole && validStatus;
}

function getLoginDestination(
  profile: LoginProfile
): string {
  if (profile.status === "suspended") {
    return "/suspended";
  }

  if (profile.status === "pending") {
    return "/pending";
  }

  if (
    profile.status === "active" &&
    (
      profile.role === "admin" ||
      profile.role === "staff"
    )
  ) {
    return "/dashboard";
  }

  return "/unauthorized";
}

export default function LoginPage() {
  const router = useRouter();

  const submittingRef = useRef(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [fieldErrors, setFieldErrors] =
    useState<LoginErrors>({});

  const [errorMessage, setErrorMessage] =
    useState("");

  function clearFieldError(
    field: LoginField
  ) {
    setFieldErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const next = { ...current };
      delete next[field];

      return next;
    });

    setErrorMessage("");
  }

  function validateForm(): boolean {
    const errors: LoginErrors = {};

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      errors.email = "Email wajib diisi.";
    } else if (
      normalizedEmail.length >
        MAX_EMAIL_LENGTH ||
      !EMAIL_PATTERN.test(
        normalizedEmail
      )
    ) {
      errors.email =
        "Masukkan alamat email yang valid.";
    }

    if (!password) {
      errors.password =
        "Password wajib diisi.";
    }

    setFieldErrors(errors);

    return (
      Object.keys(errors).length === 0
    );
  }

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    // Prevent duplicate submissions.
    if (submittingRef.current) {
      return;
    }

    setErrorMessage("");

    if (!validateForm()) {
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const supabase = createClient();

      const {
        data,
        error: authError,
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (authError) {
        const message =
          authError.message.toLowerCase();

        if (
          authError.code ===
            "email_not_confirmed" ||
          message.includes(
            "email not confirmed"
          )
        ) {
          setErrorMessage(
            "Email kamu belum diverifikasi. Periksa inbox atau folder spam terlebih dahulu."
          );
        } else if (
          authError.status === 429 ||
          message.includes("rate limit")
        ) {
          setErrorMessage(
            "Terlalu banyak percobaan login. Tunggu beberapa saat sebelum mencoba lagi."
          );
        } else {
          setErrorMessage(
            "Email atau password tidak cocok. Periksa kembali keduanya."
          );
        }

        return;
      }

      if (!data.user) {
        setErrorMessage(
          "Login belum berhasil. Silakan coba kembali."
        );

        return;
      }

      // Fetch the current account profile.
      const {
        data: profile,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("role, status")
        .eq("id", data.user.id)
        .single();

      if (
        profileError ||
        !isLoginProfile(profile)
      ) {
        await supabase.auth.signOut({
          scope: "local",
        });

        setErrorMessage(
          "Profil akun tidak ditemukan atau tidak dapat diakses. Hubungi administrator."
        );

        return;
      }

      const destination =
        getLoginDestination(profile);

      // Account authorization must also be
      // enforced on protected server routes.
      router.replace(destination);
      router.refresh();
    } catch (error) {
      console.error(
        "Login request failed:",
        error
      );

      setErrorMessage(
        "Terjadi masalah saat menghubungi server. Silakan coba lagi."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back!"
      description="Senang melihatmu lagi. Yuk, kelola inventory bakery dengan lebih mudah."
    >
      <form
        noValidate
        onSubmit={(event) =>
          void handleLogin(event)
        }
        className="space-y-5"
      >
        {/* Email */}
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-[#594c40]"
          >
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
              maxLength={MAX_EMAIL_LENGTH}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearFieldError("email");
              }}
              disabled={loading}
              aria-invalid={Boolean(
                fieldErrors.email
              )}
              aria-describedby={
                fieldErrors.email
                  ? "login-email-error"
                  : undefined
              }
              className="po-input pl-11"
            />
          </div>

          {fieldErrors.email && (
            <p
              id="login-email-error"
              role="alert"
              className="po-field-error"
            >
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label
            htmlFor="password"
            className="text-[#594c40]"
          >
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
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              autoComplete="current-password"
              placeholder="Masukkan password"
              value={password}
              onChange={(event) => {
                setPassword(
                  event.target.value
                );
                clearFieldError(
                  "password"
                );
              }}
              disabled={loading}
              aria-invalid={Boolean(
                fieldErrors.password
              )}
              aria-describedby={
                fieldErrors.password
                  ? "login-password-error"
                  : undefined
              }
              className="po-input pl-11 pr-12"
            />

            <button
              type="button"
              disabled={loading}
              onClick={() =>
                setShowPassword(
                  (current) => !current
                )
              }
              aria-label={
                showPassword
                  ? "Sembunyikan password"
                  : "Tampilkan password"
              }
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-2xl text-[#938574] transition-colors hover:text-[#463a30] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#778766] disabled:cursor-not-allowed disabled:opacity-50"
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
              id="login-password-error"
              role="alert"
              className="po-field-error"
            >
              {fieldErrors.password}
            </p>
          )}
        </div>

        {/* Forgot Password */}
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="rounded-sm text-sm font-semibold text-[#617451] underline-offset-4 transition-colors hover:text-[#46583b] hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#778766]"
          >
            Lupa password?
          </Link>
        </div>

        {/* Authentication feedback */}
        {errorMessage && (
          <div
            role="alert"
            aria-live="polite"
            className="rounded-xl border border-[#f0d5d0] bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#a44942]"
          >
            {errorMessage}
          </div>
        )}

        {/* Login button */}
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
              Sedang masuk...
            </>
          ) : (
            <>
              Masuk ke PantryOven
              <ArrowRight
                aria-hidden="true"
                className="ml-2 size-4"
              />
            </>
          )}
        </Button>

        {/* Registration */}
        <div className="pt-3 text-center text-sm text-[#8a7b6b]">
          Belum punya akun?{" "}
          <Link
            href="/register"
            className="font-bold text-[#617451] underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#778766]"
          >
            Daftar sekarang
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
