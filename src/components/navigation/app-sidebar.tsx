
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowLeftRight,
  LayoutDashboard,
  Package,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

type UserRole = "admin" | "staff";

type NavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  role?: UserRole;
};

const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Inventory",
    href: "/inventory",
    icon: Package,
  },
  {
    title: "Transactions",
    href: "/transactions",
    icon: ArrowLeftRight,
  },
];

const adminNavigationItems: NavigationItem[] = [
  {
    title: "User Management",
    href: "/admin/users",
    icon: UsersRound,
  },
];

function isActivePath(
  pathname: string,
  href: string
): boolean {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}

export function AppSidebar({
  collapsed,
  onNavigate,
  role = "staff",
}: AppSidebarProps) {
  const pathname = usePathname();

  const items =
    role === "admin"
      ? [...navigationItems, ...adminNavigationItems]
      : navigationItems;

  return (
    <div
      className={[
        "flex h-full min-h-0 w-[248px] flex-col",
        "overflow-hidden text-[#343b32]",
      ].join(" ")}
    >
      {/* Main navigation — no sidebar logo */}
      <nav
        aria-label="Main navigation"
        className={[
          "min-h-0 flex-1 space-y-1.5",
          "overflow-y-auto overflow-x-hidden",
          "px-3 pt-4 pb-3",
        ].join(" ")}
      >
        {items.map((item) => {
          const Icon = item.icon;

          const active = isActivePath(
            pathname,
            item.href
          );

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-label={item.title}
              aria-current={
                active ? "page" : undefined
              }
              title={
                collapsed ? item.title : undefined
              }
              className={[
                "relative flex min-h-11 items-center",
                "gap-3 rounded-2xl px-2.5",
                "text-sm font-medium",
                "transition-colors duration-200",
                "motion-reduce:transition-none",
                "focus-visible:outline-2",
                "focus-visible:outline-offset-2",
                "focus-visible:outline-[#536d50]",
                active
                  ? "bg-[#8fa58a]/20 text-[#343b32]"
                  : [
                      "text-[#536d50]",
                      "hover:bg-[#8fa58a]/10",
                      "hover:text-[#343b32]",
                    ].join(" "),
              ].join(" ")}
            >
              <Icon
                aria-hidden="true"
                className={[
                  "size-5 shrink-0",
                  active
                    ? "text-[#536d50]"
                    : "text-[#8fa58a]",
                ].join(" ")}
              />

              <span
                className={[
                  "min-w-0 flex-1 truncate",
                  "whitespace-nowrap",
                  "transition-[opacity,transform]",
                  "duration-200 ease-out",
                  "motion-reduce:transition-none",
                  collapsed
                    ? [
                        "-translate-x-1.5 opacity-0",
                        "group-hover/sidebar:translate-x-0",
                        "group-hover/sidebar:opacity-100",
                        "group-focus-within/sidebar:translate-x-0",
                        "group-focus-within/sidebar:opacity-100",
                      ].join(" ")
                    : "translate-x-0 opacity-100",
                ].join(" ")}
              >
                {item.title}
              </span>

              {active && (
                <span
                  aria-hidden="true"
                  className={[
                    "size-1.5 shrink-0 rounded-full",
                    "bg-[#536d50]",
                    "transition-opacity duration-200",
                    collapsed
                      ? [
                          "opacity-0",
                          "group-hover/sidebar:opacity-100",
                          "group-focus-within/sidebar:opacity-100",
                        ].join(" ")
                      : "opacity-100",
                  ].join(" ")}
                />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
