
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowLeftRight,
  ChefHat,
  LayoutDashboard,
  Package,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import { AppSidebar } from "./app-sidebar";
import { AccountMenu } from "./account-menu";

type UserRole = "admin" | "staff";

type AdminShellProps = {
  children: ReactNode;
  role?: UserRole;
  fullName?: string | null;
};

type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const primaryNavigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Inventory",
    href: "/inventory",
    icon: Package,
  },
  {
    label: "Transactions",
    href: "/transactions",
    icon: ArrowLeftRight,
  },
];

const adminNavigation: NavigationItem = {
  label: "Users",
  href: "/admin/users",
  icon: UsersRound,
};

function isActivePath(
  pathname: string,
  href: string
): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export function AdminShell({
  children,
  role = "staff",
  fullName,
}: AdminShellProps) {
  const pathname = usePathname();

  const mobileNavigation =
    role === "admin"
      ? [...primaryNavigation, adminNavigation]
      : primaryNavigation;

  return (
    <div className="po-workspace flex min-h-dvh min-w-0">
      {/* =====================================
          Desktop Hover Sidebar
      ===================================== */}

      <aside
        aria-label="Navigasi utama"
        className={[
          "sticky top-0 z-50",
          "hidden h-dvh w-[88px]",
          "shrink-0 p-3 pr-0 lg:block",
        ].join(" ")}
      >
        <div
          className={[
            "group/sidebar relative h-full w-[64px]",
            "overflow-hidden rounded-[26px]",
            "border border-white/30",
            "bg-[#faf7f0]/30",
            "backdrop-blur-2xl",
            "shadow-[0_8px_32px_rgba(52,59,50,0.05)]",
            "transition-[width,background-color,box-shadow]",
            "duration-300 ease-out",
            "hover:w-[248px]",
            "focus-within:w-[248px]",
            "hover:bg-[#faf7f0]/60",
            "focus-within:bg-[#faf7f0]/60",
            "hover:shadow-[0_18px_48px_rgba(52,59,50,0.12)]",
            "motion-reduce:transition-none",
          ].join(" ")}
        >
          <AppSidebar
            collapsed
            onToggle={() => {}}
            role={role}
          />
        </div>
      </aside>

      {/* =====================================
          Main Workspace
      ===================================== */}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Floating Glass Topbar */}
        <div className="sticky top-0 z-40 px-3 pt-3 sm:px-5 lg:px-6">
          <header
            className={[
              "flex min-h-16 items-center",
              "justify-between gap-3",
              "rounded-[26px]",
              "border border-white/30",
              "bg-[#faf7f0]/30",
              "px-4 sm:px-5",
              "backdrop-blur-2xl",
              "shadow-[0_8px_32px_rgba(52,59,50,0.05)]",
            ].join(" ")}
          >
            {/* PantryOven brand — desktop & mobile */}
            <Link
              href="/dashboard"
              aria-label="PantryOven Dashboard"
              className={[
                "flex min-w-0 items-center gap-2.5",
                "rounded-xl",
                "focus-visible:outline-2",
                "focus-visible:outline-offset-2",
                "focus-visible:outline-[#536d50]",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-9 shrink-0 items-center",
                  "justify-center rounded-xl",
                  "bg-[#8fa58a]/15",
                  "text-[#536d50]",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
                ].join(" ")}
              >
                <ChefHat
                  aria-hidden="true"
                  className="size-5"
                />
              </span>

              <span className="truncate text-sm font-bold tracking-tight text-[#343b32] sm:text-base">
                PantryOven
              </span>
            </Link>

            {/* Account menu */}
            <AccountMenu
              fullName={fullName}
              role={role}
            />
          </header>
        </div>

        {/* Page Content */}
        <main
          id="main-content"
          className={[
            "min-w-0 flex-1",
            "px-3 pt-5",
            "pb-[calc(7rem+env(safe-area-inset-bottom))]",
            "sm:px-5 sm:pt-6",
            "lg:px-6 lg:pb-8",
          ].join(" ")}
        >
          {children}
        </main>
      </div>

      {/* =====================================
          Mobile Floating Bottom Navigation
      ===================================== */}

      <nav
        aria-label="Navigasi mobile"
        className={[
          "po-mobile-dock pointer-events-none",
          "fixed inset-x-0 bottom-0 z-40",
          "px-3 pt-2 lg:hidden",
        ].join(" ")}
      >
        <div
          className={[
            "po-glass pointer-events-auto",
            "mx-auto flex max-w-md",
            "items-center justify-around gap-1",
            "rounded-[24px] px-2 py-2",
          ].join(" ")}
        >
          {mobileNavigation.map((item) => {
            const Icon = item.icon;

            const active = isActivePath(
              pathname,
              item.href
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                aria-current={
                  active ? "page" : undefined
                }
                className={[
                  "flex min-h-14 min-w-0 flex-1",
                  "flex-col items-center justify-center",
                  "gap-1 rounded-2xl px-1",
                  "text-[11px] font-medium",
                  "transition-colors",
                  "focus-visible:outline-2",
                  "focus-visible:outline-offset-2",
                  active
                    ? "bg-[#8fa58a]/20 text-[#343b32]"
                    : "text-[#536d50] hover:bg-[#8fa58a]/10",
                ].join(" ")}
              >
                <Icon
                  aria-hidden="true"
                  className="size-5 shrink-0"
                />

                <span className="max-w-full truncate">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
