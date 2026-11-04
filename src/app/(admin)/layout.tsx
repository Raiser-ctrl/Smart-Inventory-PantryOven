
import type { ReactNode } from "react";

import { requireApprovedUser } from "@/lib/auth";
import { AdminShell } from "@/components/navigation/admin-shell";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  // Verify the user and retrieve their approved profile
  const profile = await requireApprovedUser();

  return (
    <AdminShell
      role={profile.role}
      fullName={profile.full_name}
    >
      {children}
    </AdminShell>
  );
}
