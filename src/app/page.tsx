
import { redirect } from "next/navigation";

import { requireProfile } from "@/lib/auth";

export default async function HomePage() {
  const profile = await requireProfile();

  if (profile.status === "pending") {
    redirect("/pending");
  }

  if (profile.status === "suspended") {
    redirect("/suspended");
  }

  if (profile.status === "active") {
    redirect("/dashboard");
  }

  redirect("/unauthorized");
}
