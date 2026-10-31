
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
} from "lucide-react";

const navigationItems = [
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

type AppSidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
};

export function AppSidebar({
  collapsed,
  onToggle,
  onNavigate,
}: AppSidebarProps) {
  const pathname = usePathname();

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
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <ChefHat className="size-5" />
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
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      {/* Expand sidebar */}
      {collapsed && (
        <div className="flex shrink-0 justify-center pt-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex size-9 items-center justify-center rounded-lg text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      )}

      {/* Main navigation */}
      <nav
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Main navigation"
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;

          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={
                isActive ? "page" : undefined
              }
              title={
                collapsed ? item.title : undefined
              }
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
              <Icon className="size-5 shrink-0" />

              {!collapsed && (
                <span className="truncate">
                  {item.title}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
