
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type LogoutButtonProps = {
  variant?: "default" | "outline" | "ghost";
  className?: string;
  showLabel?: boolean;
};

export function LogoutButton({
  variant = "ghost",
  className = "",
  showLabel = true,
}: LogoutButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogout() {
    if (loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        setErrorMessage("Gagal keluar. Silakan coba lagi.");
        return;
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setErrorMessage("Terjadi kesalahan saat logout.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant={variant}
        onClick={handleLogout}
        disabled={loading}
        aria-label={showLabel ? undefined : "Keluar dari akun"}
        title={showLabel ? undefined : "Logout"}
        className={`gap-2 ${className}`}
      >
        {loading ? (
          <Loader2
            aria-hidden="true"
            className="size-4 animate-spin"
          />
        ) : (
          <LogOut aria-hidden="true" className="size-4" />
        )}

        {showLabel && (loading ? "Sedang keluar..." : "Logout")}
      </Button>

      {errorMessage && (
        <p role="alert" className="text-xs text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
