"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  item: {
    id: string;
    name: string;
    archived_at: string | null;
  };
};

export function ArchiveItemDialog({ item }: Props) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isArchived = item.archived_at !== null;

  async function handleAction() {
    const confirmed = window.confirm(
      isArchived
        ? `Aktifkan kembali "${item.name}"?`
        : `Arsipkan "${item.name}"? Riwayat transaksi akan tetap tersimpan.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const endpoint = isArchived ? "restore" : "archive";

      const response = await fetch(
        `/api/v1/items/${item.id}/${endpoint}`,
        {
          method: "POST",
          credentials: "same-origin",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ?? "Gagal mengubah status barang."
        );
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={handleAction}
      >
        {isArchived ? (
          <RotateCcw className="mr-2 h-4 w-4" />
        ) : (
          <Archive className="mr-2 h-4 w-4" />
        )}

        {loading
          ? "Processing..."
          : isArchived
            ? "Restore"
            : "Archive"}
      </Button>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}