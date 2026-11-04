
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Check,
  ChevronDown,
  Settings2,
  UserRound,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/logout-button";

type UserRole = "admin" | "staff";

type AccountMenuProps = {
  fullName?: string | null;
  role?: UserRole;
};

const accountLinks = [
  {
    label: "My Profile",
    href: "/profile",
    icon: UserRound,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings2,
  },
];

export function AccountMenu({
  fullName,
  role = "staff",
}: AccountMenuProps) {
  const pathname = usePathname();

  const displayName =
    fullName?.trim() || "Pengguna PantryOven";

  const initials =
    fullName
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "PO";

  const roleLabel = role === "admin" ? "Administrator" : "Staff";

  return (
    <DropdownMenu>
      {/* Account trigger */}
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={`Buka menu akun ${displayName}`}
          className="group h-11 gap-1.5 rounded-xl border border-transparent px-1.5 transition-colors hover:border-border/70 hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:px-2"
        >
          <Avatar className="size-9 shrink-0 border border-[#dce6d6]">
            <AvatarFallback className="bg-[#edf2e9] text-xs font-bold tracking-wide text-[#526b47]">
              {initials}
            </AvatarFallback>
          </Avatar>

          <ChevronDown
            aria-hidden="true"
            className="hidden size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block"
          />
        </Button>
      </DropdownMenuTrigger>

      {/* Account dropdown */}
      <DropdownMenuContent
        align="end"
        sideOffset={10}
        collisionPadding={12}
        className="w-[min(17rem,calc(100vw-1.5rem))] rounded-2xl border-border/70 p-1.5 shadow-xl"
      >
        {/* User identity */}
        <DropdownMenuLabel className="px-2 py-2.5 font-normal">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-11 shrink-0 border border-[#dce6d6]">
              <AvatarFallback className="bg-[#edf2e9] text-sm font-semibold text-[#526b47]">
                {initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {displayName}
              </p>

              <p className="mt-0.5 text-xs text-muted-foreground">
                {roleLabel}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="my-1" />

        {/* Navigation links */}
        <div className="space-y-0.5 py-1">
          {accountLinks.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <DropdownMenuItem
                key={item.href}
                asChild
                className="cursor-pointer rounded-xl p-0 focus:bg-accent"
              >
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex w-full items-center gap-3 px-3 py-2.5"
                >
                  <Icon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground"
                  />

                  <span className="flex-1 text-sm font-medium">
                    {item.label}
                  </span>

                  {active && (
                    <Check
                      aria-hidden="true"
                      className="size-4 shrink-0 text-[#617451]"
                    />
                  )}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </div>

        <DropdownMenuSeparator className="my-1" />

        {/* Logout */}
        <div className="p-1">
          <LogoutButton
            variant="ghost"
            showLabel
            className="h-10 w-full justify-start gap-3 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
