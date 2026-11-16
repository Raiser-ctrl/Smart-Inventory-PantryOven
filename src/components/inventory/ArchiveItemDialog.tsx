
"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  Archive,
  Loader2,
  RotateCcw,
} from "lucide-react";

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

export function ArchiveItemDialog({
  item,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Prevent duplicate requests synchronously.
  const submittingRef = useRef(false);

  const isArchived = item.archived_at !== null;

  const action = isArchived
    ? "restore"
    : "archive";

  const actionLabel = isArchived
    ? "Restore item"
    : "Archive item";

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
        `/api/v1/items/${encodeURIComponent(
          item.id
        )}/${action}`,
        {
          method: "POST",
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
            `Gagal ${
              isArchived
                ? "memulihkan"
                : "mengarsipkan"
            } barang. Silakan coba lagi.`
        );
      }

      // Close after confirmed success.
      setOpen(false);
      setError("");

      // Refresh server-rendered inventory data.
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
      {/* Trigger */}
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading}
          className={[
            "h-9 rounded-xl px-3",
            "border-[#8FA58A]/20",
            "bg-white/65",
            "text-[#536D50]",
            "transition-colors",
            "hover:bg-white/90",
            "hover:text-[#343B32]",
            "disabled:opacity-50",
          ].join(" ")}
        >
          {isArchived ? (
            <RotateCcw
              aria-hidden="true"
              className="mr-1.5 size-4"
            />
          ) : (
            <Archive
              aria-hidden="true"
              className="mr-1.5 size-4"
            />
          )}

          {isArchived ? "Restore" : "Archive"}
        </Button>
      </AlertDialogTrigger>

      {/* Confirmation dialog */}
      <AlertDialogContent
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
        <AlertDialogHeader className="space-y-3 text-left sm:text-left">
          {/* Icon */}
          <div
            className={[
              "flex size-12 items-center",
              "justify-center rounded-2xl",
              isArchived
                ? "bg-[#8FA58A]/15 text-[#536D50]"
                : "bg-[#C9857C]/12 text-[#B76F67]",
            ].join(" ")}
          >
            {isArchived ? (
              <RotateCcw
                aria-hidden="true"
                className="size-5"
              />
            ) : (
              <Archive
                aria-hidden="true"
                className="size-5"
              />
            )}
          </div>

          {/* Title */}
          <AlertDialogTitle className="text-lg font-semibold tracking-tight text-[#343B32]">
            {isArchived
              ? "Restore this item?"
              : "Archive this item?"}
          </AlertDialogTitle>

          {/* Description */}
          <AlertDialogDescription className="text-sm leading-relaxed text-[#7A8775]">
            {isArchived
              ? "This item will return to your active inventory."
              : "This item will be hidden from active inventory. You can restore it anytime."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Selected item */}
        <div className="rounded-2xl border border-[#8FA58A]/15 bg-white/60 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[#7A8775]">
            Selected item
          </p>

          <p className="mt-1 break-words text-sm font-semibold text-[#343B32]">
            {item.name}
          </p>
        </div>

        {/* Additional information */}
        {!isArchived && (
          <p className="text-xs leading-relaxed text-[#7A8775]">
            Transaction history will remain saved.
            Archiving does not permanently delete
            this item.
          </p>
        )}

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
        <AlertDialogFooter className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel
            disabled={loading}
            className={[
              "mt-0 h-11 rounded-xl",
              "border-[#8FA58A]/20",
              "bg-white/70",
              "text-[#536D50]",
              "hover:bg-white/90",
              "sm:min-w-[100px]",
            ].join(" ")}
          >
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction
            disabled={loading}
            onClick={(event) => {
              // Keep dialog open during the request.
              event.preventDefault();
              void handleAction();
            }}
            className={[
              "h-11 rounded-xl px-5",
              "font-semibold text-white",
              "transition-colors",
              "disabled:opacity-60",
              "sm:min-w-[140px]",
              isArchived
                ? "bg-[#536D50] hover:bg-[#435A40]"
                : "bg-[#B76F67] hover:bg-[#A65C55]",
            ].join(" ")}
          >
            {loading ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="mr-2 size-4 animate-spin"
                />
                Processing...
              </>
            ) : (
              <>
                {isArchived ? (
                  <RotateCcw
                    aria-hidden="true"
                    className="mr-1.5 size-4"
                  />
                ) : (
                  <Archive
                    aria-hidden="true"
                    className="mr-1.5 size-4"
                  />
                )}

                {actionLabel}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
