
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Props = {
  item: {
    id: string;
    name: string;
    archived_at: string | null;
  };
};

export function ArchiveItemDialog({ item }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isArchived = item.archived_at !== null;

  async function handleAction() {
    if (loading) return;

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

      setOpen(false);
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
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (loading) return;

        setOpen(nextOpen);

        if (!nextOpen) {
          setError("");
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
        >
          {isArchived ? (
            <RotateCcw className="mr-2 size-4" />
          ) : (
            <Archive className="mr-2 size-4" />
          )}

          {isArchived ? "Restore" : "Archive"}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-muted">
            {isArchived ? (
              <RotateCcw className="size-5 text-foreground" />
            ) : (
              <Archive className="size-5 text-foreground" />
            )}
          </div>

          <AlertDialogTitle>
            {isArchived ? "Restore item?" : "Archive item?"}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {isArchived ? (
              <>
                <span className="font-medium text-foreground">
                  {item.name}
                </span>{" "}
                will be restored to your active inventory.
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {item.name}
                </span>{" "}
                will be removed from active inventory.
                Transaction history will remain saved, and
                you can restore this item anytime.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              event.preventDefault();
              void handleAction();
            }}
          >
            {loading
              ? "Processing..."
              : isArchived
                ? "Restore item"
                : "Archive item"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
