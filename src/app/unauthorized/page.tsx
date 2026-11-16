import Link from "next/link";

import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <AuthShell
      illustration="unauthorized"
      title="Akses terbatas"
      description="Akun kamu tidak memiliki izin untuk membuka halaman ini."
    >
      <Button asChild className="po-button min-h-11 w-full">
        <Link href="/login">Kembali ke halaman masuk</Link>
      </Button>
    </AuthShell>
  );
}
