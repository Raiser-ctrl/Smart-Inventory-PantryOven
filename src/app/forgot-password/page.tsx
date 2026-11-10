
"use client";

import {
  Suspense,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

const ERROR_MESSAGES: Record<string, string> = {
  invalid_link:
    "Link reset password tidak valid, sudah digunakan, atau telah kedaluwarsa. Silakan minta link baru.",
  server_error:
    "Terjadi masalah saat memverifikasi link. Silakan coba lagi.",
  recovery_not_verified:
    "Link reset password belum berhasil diverifikasi. Silakan minta link baru.",
};

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const submittingRef = useRef(false);

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");

  const callbackError = searchParams.get("error");

  const displayedError =
    errorMessage ||
    (callbackError
      ? ERROR_MESSAGES[callbackError] ??
        ERROR_MESSAGES.invalid_link
      : "");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submittingRef.current || sent) {
      return;
    }

    setErrorMessage("");

    const normalizedEmail = email.trim();

    if (
      !normalizedEmail ||
      normalizedEmail.length > MAX_EMAIL_LENGTH ||
      !EMAIL_PATTERN.test(normalizedEmail)
    ) {
      setErrorMessage(
        "Masukkan alamat email yang valid."
      );
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    try {
      const supabase = createClient();

      const redirectTo = new URL(
        "/auth/callback",
        window.location.origin
      ).toString();

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          normalizedEmail,
          { redirectTo }
        );

      if (error) {
        const errorCode = error.code ?? "";
        const errorText =
          error.message.toLowerCase();

        if (
          error.status === 429 ||
          errorCode === "over_email_send_rate_limit" ||
          errorCode === "over_request_rate_limit" ||
          errorText.includes("rate limit")
        ) {
          setErrorMessage(
            "Terlalu banyak permintaan reset password. Tunggu beberapa saat sebelum mencoba lagi."
          );
          return;
        }

        setErrorMessage(
          "Permintaan reset password belum dapat diproses. Silakan coba lagi nanti."
        );
        return;
      }

      setSent(true);
      setErrorMessage("");
    } catch {
      setErrorMessage(
        "Tidak dapat menghubungi server. Periksa koneksi internet lalu coba lagi."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={
        sent
          ? "Periksa email kamu!"
          : "Lupa password?"
      }
      description={
        sent
          ? "Jika email terdaftar, kamu akan menerima tautan untuk mengatur ulang password."
          : "Masukkan email akun PantryOven untuk menerima tautan reset password."
      }
    >
      {sent ? (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#e8efe2]">
            <CheckCircle2
              aria-hidden="true"
              className="size-7 text-[#617451]"
            />
          </div>

          <p className="text-sm leading-6 text-[#8a7b6b]">
            Jika alamat email terdaftar, periksa
            inbox atau folder spam untuk menemukan
            tautan reset password.
          </p>

          <p className="text-xs leading-5 text-[#938574]">
            Buka link terbaru menggunakan browser
            dan profil yang sama dengan tempat
            kamu meminta reset password.
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
      ) : (
        <form
          noValidate
          onSubmit={(event) =>
            void handleSubmit(event)
          }
          className="space-y-5"
        >
          <div className="space-y-2">
            <Label
              htmlFor="forgot-email"
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
                id="forgot-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={MAX_EMAIL_LENGTH}
                placeholder="nama@email.com"
                value={email}
                disabled={loading}
                required
                aria-invalid={Boolean(displayedError)}
                aria-describedby={
                  displayedError
                    ? "forgot-password-error"
                    : undefined
                }
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrorMessage("");
                }}
                className="po-input pl-11"
              />
            </div>
          </div>

          {displayedError && (
            <div
              id="forgot-password-error"
              role="alert"
              className="rounded-xl border border-[#f0d5d0] bg-[#fff5f3] px-4 py-3 text-sm leading-6 text-[#a44942]"
            >
              {displayedError}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="po-button w-full font-semibold"
          >
            {loading ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
                />
                Mengirim...
              </>
            ) : (
              <>
                Kirim Link Reset
                <ArrowRight
                  aria-hidden="true"
                  className="ml-2 size-4"
                />
              </>
            )}
          </Button>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-sm text-sm font-semibold text-[#617451] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#778766]"
            >
              <ArrowLeft className="size-4" />
              Kembali ke Login
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <AuthShell
          title="Lupa password?"
          description="Masukkan email akun PantryOven untuk menerima tautan reset password."
        >
          <div
            role="status"
            className="flex min-h-40 items-center justify-center"
          >
            <Loader2
              aria-hidden="true"
              className="size-6 animate-spin text-[#617451]"
            />
            <span className="sr-only">
              Memuat halaman...
            </span>
          </div>
        </AuthShell>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
