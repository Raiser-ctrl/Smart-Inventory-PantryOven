
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Loader2, RotateCcw } from "lucide-react";

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

type ApiResponse = {
  success?: boolean;
  message?: string;
};

export function ArchiveItemDialog({ item }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Synchronous protection against duplicate requests.
  const submittingRef = useRef(false);

  const isArchived = item.archived_at !== null;
  const action = isArchived ? "restore" : "archive";

  function handleOpenChange(nextOpen: boolean) {
    if (submittingRef.current) return;

    setOpen(nextOpen);

    if (!nextOpen) {
      setError("");
    }
  }

  async function handleAction() {
    if (submittingRef.current) return;

    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/v1/items/${encodeURIComponent(item.id)}/${action}`,
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      const result: ApiResponse | null =
        await response.json().catch(() => null);

      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.message ??
            `Gagal ${
              isArchived ? "memulihkan" : "mengarsipkan"
            } barang. Silakan coba lagi.`
        );
      }

      // The server confirmed success.
      setOpen(false);
      setError("");

      // Refresh inventory data from Server Components.
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Terjadi kesalahan saat mengubah status barang."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={handleOpenChange}
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
            {isArchived
              ? "Restore item?"
              : "Archive item?"}
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
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Processing...
              </>
            ) : isArchived ? (
              "Restore item"
            ) : (
              "Archive item"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
