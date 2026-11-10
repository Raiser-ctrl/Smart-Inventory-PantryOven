
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DeleteItemDialogProps = {
  item: {
    id: string;
    name: string;
  };
};

type ApiResponse = {
  success?: boolean;
  message?: string;
};

export function DeleteItemDialog({
  item,
}: DeleteItemDialogProps) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Prevent simultaneous delete requests.
  const deletingRef = useRef(false);

  function handleOpenChange(nextOpen: boolean) {
    if (deletingRef.current) return;

    setOpen(nextOpen);
    setError("");
  }

  async function handleDelete() {
    // Synchronous double-submit protection.
    if (deletingRef.current) return;

    deletingRef.current = true;
    setIsDeleting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/v1/items/${encodeURIComponent(item.id)}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      // Handle invalid or empty JSON responses safely.
      const result: ApiResponse | null =
        await response.json().catch(() => null);

      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.message ??
            "Gagal menghapus barang. Silakan coba lagi."
        );
      }

      // Deletion was confirmed by the server.
      setOpen(false);
      setError("");

      // Refresh inventory Server Components.
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Terjadi kesalahan saat menghapus barang."
      );
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          aria-label={`Delete ${item.name}`}
          disabled={isDeleting}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Delete Item
          </DialogTitle>

          <DialogDescription>
            Are you sure you want to permanently delete{" "}
            <span className="font-semibold">
              {item.name}
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Items with transaction history cannot be deleted
          to protect inventory records.
        </p>

        {error && (
          <p
            role="alert"
            className="text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              void handleDelete();
            }}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Item
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
