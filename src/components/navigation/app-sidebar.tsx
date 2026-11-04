
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowLeftRight,
  ChefHat,
  LayoutDashboard,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  UsersRound,
} from "lucide-react";

type UserRole = "admin" | "staff";

type NavigationItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
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

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  role?: UserRole;
};

export function AppSidebar({
  collapsed,
  onToggle,
  onNavigate,
  role = "staff",
}: AppSidebarProps) {
  const pathname = usePathname();

  const items =
    role === "admin"
      ? [...navigationItems, ...adminNavigationItems]
      : navigationItems;

  return (
    <aside
      className={`flex h-full min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      {/* Branding */}
      <div
        className={`flex h-16 shrink-0 items-center border-b border-sidebar-border ${
          collapsed
            ? "justify-center px-2"
            : "justify-between px-4"
        }`}
      >
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-3"
          aria-label="PantryOven Dashboard"
          title={collapsed ? "PantryOven" : undefined}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ChefHat
              aria-hidden="true"
              className="size-5"
            />
          </div>

          {!collapsed && (
            <span className="truncate text-lg font-semibold tracking-tight">
              PantryOven
            </span>
          )}
        </Link>

        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <PanelLeftClose
              aria-hidden="true"
              className="size-4"
            />
          </button>
        )}
      </div>

      {/* Expand sidebar */}
      {collapsed && (
        <div className="flex shrink-0 justify-center pt-3">
          <button
            type="button"
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <PanelLeftOpen
              aria-hidden="true"
              className="size-4"
            />
          </button>
        </div>
      )}

      {/* Main navigation */}
      <nav
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Main navigation"
      >
        {items.map((item) => {
          const Icon = item.icon;

          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? item.title : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              } ${
                collapsed
                  ? "justify-center px-0"
                  : "px-3"
              }`}
            >
              <Icon
                aria-hidden="true"
                className="size-5 shrink-0"
              />

              {!collapsed && (
                <span className="truncate">
                  {item.title}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      <div
        className={`shrink-0 border-t border-sidebar-border ${
          collapsed ? "px-2 py-3" : "px-4 py-4"
        }`}
      >
        {collapsed ? (
          <div
            className="mx-auto size-1.5 rounded-full bg-[#8a9c79]"
            aria-hidden="true"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span
              className="size-1.5 shrink-0 rounded-full bg-[#8a9c79]"
              aria-hidden="true"
            />

            <p className="truncate text-xs text-sidebar-foreground/50">
              PantryOven Workspace
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
