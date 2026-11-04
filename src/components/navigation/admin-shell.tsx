
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChefHat, Menu, X } from "lucide-react";

import { AppSidebar } from "./app-sidebar";
import { AccountMenu } from "./account-menu";

type UserRole = "admin" | "staff";

type AdminShellProps = {
  children: ReactNode;
  role?: UserRole;
  fullName?: string | null;
};

export function AdminShell({
  children,
  role = "staff",
  fullName,
}: AdminShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMobileNavigation() {
    setMobileOpen(false);
  }

  // Close mobile navigation with Escape
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  // Prevent background scrolling while mobile menu is open
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  return (
    <div className="flex min-h-dvh min-w-0 bg-background">
      {/* Desktop sidebar */}
      <div className="sticky top-0 hidden h-dvh shrink-0 md:block">
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((value) => !value)}
          role={role}
        />
      </div>

      {/* Mobile navigation */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Tutup navigasi"
            className="absolute inset-0 bg-black/50"
            onClick={closeMobileNavigation}
          />

          <div
            id="mobile-sidebar"
            className="absolute inset-y-0 left-0 w-64 max-w-[85vw] bg-background shadow-xl"
          >
            <AppSidebar
              collapsed={false}
              onToggle={closeMobileNavigation}
              onNavigate={closeMobileNavigation}
              role={role}
            />
          </div>

          <button
            type="button"
            aria-label="Tutup sidebar"
            onClick={closeMobileNavigation}
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg border bg-background shadow-sm transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:h-16 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile menu button */}
            <button
              type="button"
              aria-label="Buka navigasi"
              aria-expanded={mobileOpen}
              aria-controls="mobile-sidebar"
              onClick={() => setMobileOpen(true)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden"
            >
              <Menu aria-hidden="true" className="size-5" />
            </button>

            {/* Mobile branding */}
            <div className="flex min-w-0 items-center gap-2 md:hidden">
              <ChefHat
                aria-hidden="true"
                className="size-5 shrink-0"
              />

              <span className="truncate text-sm font-semibold tracking-tight">
                PantryOven
              </span>
            </div>
          </div>

          {/* Account dropdown */}
          <AccountMenu
            fullName={fullName}
            role={role}
          />
        </header>

        {/* Page content */}
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
