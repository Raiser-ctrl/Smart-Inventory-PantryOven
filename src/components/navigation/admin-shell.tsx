
"use client";

import { useState } from "react";
import { AppSidebar } from "./app-sidebar";

import {
  Menu,
  X,
  ChefHat,
  CircleUserRound,
} from "lucide-react";

type AdminShellProps = {
  children: React.ReactNode;
};

export function AdminShell({
  children,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileNavigation() {
    setMobileOpen(false);
  }

  return (
    <div className="flex min-h-dvh min-w-0 bg-background">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-dvh shrink-0 md:block">
        <AppSidebar
          collapsed={collapsed}
          onToggle={() =>
            setCollapsed((value) => !value)
          }
        />
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/50"
            onClick={closeMobileNavigation}
          />

          {/* Sidebar panel */}
          <div className="absolute inset-y-0 left-0 w-64 max-w-[85vw] bg-background shadow-xl">
            <AppSidebar
              collapsed={false}
              onToggle={closeMobileNavigation}
              onNavigate={closeMobileNavigation}
            />
          </div>

          {/* Close button */}
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={closeMobileNavigation}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg border bg-background shadow-sm transition-colors hover:bg-accent"
          >
            <X className="size-5" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Minimal topbar */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:h-16 md:px-6">
          {/* Left section */}
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile menu button */}
            <button
              type="button"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent md:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="size-5" />
            </button>

            {/* Mobile branding */}
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <ChefHat className="size-5 shrink-0" />

              <span className="truncate text-sm font-semibold tracking-tight">
                PantryOven
              </span>
            </div>
          </div>

          {/* Account indicator */}
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full border bg-muted"
            aria-label="Admin account"
          >
            <CircleUserRound className="size-5 text-muted-foreground" />
          </div>
        </header>

        {/* Page content */}
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
