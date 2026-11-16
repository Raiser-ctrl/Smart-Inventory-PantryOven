import type { ReactNode } from "react";

import { requireApprovedUser } from "@/lib/auth";
import { AdminShell } from "@/components/navigation/admin-shell";
import BreadyCopilot from "@/components/bready/BreadyCopilot";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  const profile = await requireApprovedUser();

  return (
    <AdminShell
      role={profile.role}
      fullName={profile.full_name}
    >
      {children}
      <BreadyCopilot />
    </AdminShell>
  );
}