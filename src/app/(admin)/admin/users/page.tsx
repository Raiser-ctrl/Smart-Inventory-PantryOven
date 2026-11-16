import { requireAdmin } from "@/lib/auth";
import { UserManagementTable } from "@/components/admin/user-management-table";

export const dynamic = "force-dynamic";

export default async function UserManagementPage() {
  // Verify that the current user is an active administrator
  const profile = await requireAdmin();

  return (
    <main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-5 pb-28 text-[#343B32] sm:px-6 md:px-8 md:pt-8 lg:pb-8">
      <UserManagementTable currentUserId={profile.id} />
    </main>
  );
}