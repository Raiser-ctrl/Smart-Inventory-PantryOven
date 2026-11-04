
import { requireAdmin } from "@/lib/auth";
import { UserManagementTable } from "@/components/admin/user-management-table";

export const dynamic = "force-dynamic";

export default async function UserManagementPage() {
  // Allow active administrators only
  await requireAdmin();

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      <UserManagementTable />
    </div>
  );
}
