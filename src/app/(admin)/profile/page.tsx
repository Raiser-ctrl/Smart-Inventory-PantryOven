
import { requireApprovedUser } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/profile-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  // Allow active authenticated users only
  const profile = await requireApprovedUser();

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl px-3 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
      {/* Page heading */}
      <header className="mb-5 sm:mb-6">
        <p className="mb-2 text-sm font-medium text-[#617451]">
          Account
        </p>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          My Profile
        </h1>

        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Kelola informasi pribadi dan identitas akun PantryOven kamu.
        </p>
      </header>

      {/* Profile information */}
      <ProfileForm
        initialName={profile.full_name}
        role={profile.role}
      />
    </div>
  );
}
