
import type { ReactNode } from "react";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { ClayArt } from "./clay-art";

type AuthShellProps = {
  children: ReactNode;
  eyebrow?: string;
  title: string;
  description: string;
};

export function AuthShell({
  children,
  title,
  description,
}: AuthShellProps) {
  return (
    <main className="po-auth relative isolate min-h-dvh overflow-x-hidden bg-[#faf6f0] text-[#463a30]">
      {/* Soft background accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-24 size-64 rounded-full bg-[#f4d9c6]/35 blur-3xl"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-12 size-72 rounded-full bg-[#dce5d5]/45 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 py-6 sm:px-9 lg:px-12">
        {/* Main brand — keep original logo */}
        <header className="flex items-center justify-start">
          <Link
            href="/login"
            aria-label="PantryOven — halaman login"
            className="inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#73825f]"
          >
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#e7d5c0] shadow-[3px_4px_0_#d6bba1]">
              <ChefHat
                aria-hidden="true"
                className="size-6 text-[#805b42]"
              />
            </span>

            <span className="text-lg font-extrabold tracking-tight">
              PantryOven
              <span className="text-[#a27b5c]">.</span>
            </span>
          </Link>
        </header>

        {/* Responsive content */}
        <div className="grid flex-1 items-center gap-3 py-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-14">
          {/* Floating illustration */}
          <div className="order-1 flex min-w-0 items-center justify-center lg:order-2">
            <ClayArt />
          </div>

          {/* Authentication content */}
          <section className="po-enter order-2 mx-auto w-full min-w-0 max-w-[440px] lg:order-1">
            <div className="mb-6 space-y-2 sm:mb-7">
              <h1 className="text-[clamp(2rem,5vw,2.8rem)] font-extrabold leading-[1.15] tracking-[-0.045em]">
                {title}
              </h1>

              <p className="max-w-sm text-sm leading-7 text-[#8a7b6b]">
                {description}
              </p>
            </div>

            {/* Form container */}
            <div className="rounded-[26px] border border-white/90 bg-white/85 p-5 shadow-[0_18px_50px_#a98e7026,0_3px_8px_#a98e7010] backdrop-blur-md sm:rounded-[30px] sm:p-8">
              {children}
            </div>
          </section>
        </div>

        {/* Minimal footer */}
        <footer className="pt-5 text-center text-xs text-[#a3998c]">
          © {new Date().getFullYear()} PantryOven
        </footer>
      </div>
    </main>
  );
}
