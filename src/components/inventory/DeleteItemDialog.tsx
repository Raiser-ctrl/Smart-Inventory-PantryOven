
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  const [isDeleting, setIsDeleting] =
    useState(false);

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
        `/api/v1/items/${encodeURIComponent(
          item.id
        )}`,
        {
          method: "DELETE",
          credentials: "same-origin",
          cache: "no-store",
        }
      );

      const result: ApiResponse | null =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        result?.success !== true
      ) {
        throw new Error(
          result?.message ??
            "Gagal menghapus barang. Silakan coba lagi."
        );
      }

      // Server confirmed successful deletion.
      setOpen(false);
      setError("");

      // Refresh server-rendered inventory data.
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
      {/* Delete trigger */}
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDeleting}
          aria-label={`Delete ${item.name}`}
          className={[
            "h-9 rounded-xl px-3",
            "border-[#C9857C]/25",
            "bg-white/65",
            "text-[#B76F67]",
            "transition-colors",
            "hover:border-[#C9857C]/40",
            "hover:bg-[#C9857C]/10",
            "hover:text-[#A65C55]",
            "disabled:opacity-50",
          ].join(" ")}
        >
          <Trash2
            aria-hidden="true"
            className="mr-1.5 size-4"
          />
          Delete
        </Button>
      </DialogTrigger>

      {/* Confirmation dialog */}
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (deletingRef.current) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (deletingRef.current) {
            event.preventDefault();
          }
        }}
        className={[
          "w-[calc(100%-2rem)]",
          "max-h-[90dvh]",
          "overflow-y-auto",
          "rounded-[26px]",
          "border border-white/60",
          "bg-[#FAF7F0]/95",
          "p-5",
          "shadow-[0_24px_70px_rgba(52,59,50,0.16)]",
          "backdrop-blur-2xl",
          "sm:max-w-[420px]",
          "sm:p-6",
        ].join(" ")}
      >
        {/* Header */}
        <DialogHeader className="space-y-3 text-left sm:text-left">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-[#C9857C]/12 text-[#B76F67]">
            <Trash2
              aria-hidden="true"
              className="size-5"
            />
          </div>

          <DialogTitle className="text-lg font-semibold tracking-tight text-[#343B32]">
            Delete this item?
          </DialogTitle>

          <DialogDescription className="text-sm leading-relaxed text-[#7A8775]">
            This action permanently removes the
            selected item and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Selected item */}
        <div className="rounded-2xl border border-[#C9857C]/15 bg-white/60 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#7A8775]">
            Selected item
          </p>

          <p className="mt-1 break-words text-sm font-semibold text-[#343B32]">
            {item.name}
          </p>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2.5 rounded-xl border border-[#D4AC72]/25 bg-[#D4AC72]/10 p-3">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-[#A77D3D]"
          />

          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold text-[#A77D3D]">
              Before you delete
            </p>

            <p className="text-xs leading-relaxed text-[#A77D3D]">
              Items with transaction history cannot
              be deleted to protect inventory
              records. Consider archiving the item
              instead.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-[#C9857C]/25 bg-[#C9857C]/10 p-3"
          >
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-[#B76F67]"
            />

            <p className="text-xs leading-relaxed text-[#A65C55]">
              {error}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-2 flex flex-col-reverse gap-2 border-t border-[#8FA58A]/15 pt-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={isDeleting}
            onClick={() =>
              handleOpenChange(false)
            }
            className={[
              "h-11 rounded-xl",
              "border-[#8FA58A]/20",
              "bg-white/70",
              "text-[#536D50]",
              "hover:bg-white/90",
              "sm:min-w-[100px]",
            ].join(" ")}
          >
            <X
              aria-hidden="true"
              className="mr-1.5 size-4"
            />
            Cancel
          </Button>

          <Button
            type="button"
            disabled={isDeleting}
            onClick={() => {
              void handleDelete();
            }}
            className={[
              "h-11 rounded-xl px-5",
              "bg-[#B76F67]",
              "font-semibold text-white",
              "transition-colors",
              "hover:bg-[#A65C55]",
              "disabled:opacity-60",
              "sm:min-w-[145px]",
            ].join(" ")}
          >
            {isDeleting ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
                />
                Deleting...
              </>
            ) : (
              <>
                <Trash2
                  aria-hidden="true"
                  className="mr-1.5 size-4"
                />
                Delete item
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
