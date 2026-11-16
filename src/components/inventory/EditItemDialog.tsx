
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import {
  AlertCircle,
  Check,
  Loader2,
  Pencil,
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

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_NAME_LENGTH = 150;
const MAX_STOCK = 1_000_000_000;

const VALID_CATEGORIES = [
  "raw_material",
  "finished_product",
] as const;

const VALID_UNITS = [
  "kg",
  "pcs",
  "liter",
  "gram",
] as const;

type EditableItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  minimum_stock: number;
};

type Props = {
  item: EditableItem;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  onSuccess?: () => void;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
};

const inputClassName = [
  "h-11 rounded-xl",
  "border-[#8FA58A]/20",
  "bg-white/70",
  "text-[#343B32]",
  "placeholder:text-[#7A8775]/65",
  "focus-visible:border-[#8FA58A]",
  "focus-visible:ring-[#8FA58A]/25",
].join(" ");

const selectClassName = [
  "h-11 w-full rounded-xl",
  "border-[#8FA58A]/20",
  "bg-white/70",
  "text-[#343B32]",
  "focus-visible:border-[#8FA58A]",
  "focus-visible:ring-[#8FA58A]/25",
].join(" ");

const labelClassName =
  "text-xs font-semibold text-[#536D50]";

export function EditItemDialog({
  item,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  onSuccess,
}: Props) {
  const router = useRouter();

  const [internalOpen, setInternalOpen] =
    useState(false);

  const isControlled =
    controlledOpen !== undefined;

  const open = isControlled
    ? controlledOpen
    : internalOpen;

  const [name, setName] = useState(item.name);

  const [category, setCategory] = useState(
    item.category
  );

  const [unit, setUnit] = useState(item.unit);

  const [minimumStock, setMinimumStock] =
    useState(String(item.minimum_stock));

  const [error, setError] = useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // Prevent duplicate submissions synchronously.
  const submittingRef = useRef(false);

  // Track dialog transitions and selected item.
  const previousOpenRef = useRef(open);
  const previousItemIdRef = useRef(item.id);

  function resetForm() {
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setMinimumStock(String(item.minimum_stock));
    setError("");
  }

  // Sync form when the dialog opens
  // or when a different item is selected.
  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    const previousItemId =
      previousItemIdRef.current;

    const justOpened = open && !wasOpen;
    const itemChanged =
      item.id !== previousItemId;

    if (
      open &&
      (justOpened || itemChanged) &&
      !submittingRef.current
    ) {
      setName(item.name);
      setCategory(item.category);
      setUnit(item.unit);
      setMinimumStock(
        String(item.minimum_stock)
      );
      setError("");
    }

    previousOpenRef.current = open;
    previousItemIdRef.current = item.id;
  }, [
    open,
    item.id,
    item.name,
    item.category,
    item.unit,
    item.minimum_stock,
  ]);

  function updateOpen(nextOpen: boolean) {
    if (isControlled) {
      onOpenChange?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (submittingRef.current) return;

    if (nextOpen) {
      resetForm();
    } else {
      setError("");
    }

    updateOpen(nextOpen);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submittingRef.current) return;

    setError("");

    const trimmedName = name.trim();

    if (
      !trimmedName ||
      trimmedName.length > MAX_NAME_LENGTH
    ) {
      setError(
        "Nama barang wajib diisi dan maksimal 150 karakter."
      );
      return;
    }

    if (
      !VALID_CATEGORIES.some(
        (value) => value === category
      )
    ) {
      setError("Kategori barang tidak valid.");
      return;
    }

    if (
      !VALID_UNITS.some(
        (value) => value === unit
      )
    ) {
      setError("Satuan barang tidak valid.");
      return;
    }

    if (minimumStock.trim() === "") {
      setError("Minimum stok wajib diisi.");
      return;
    }

    const minimum = Number(minimumStock);

    if (
      !Number.isFinite(minimum) ||
      minimum < 0 ||
      minimum > MAX_STOCK
    ) {
      setError(
        "Minimum stok harus berupa angka antara 0 dan 1.000.000.000."
      );
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/v1/items/${encodeURIComponent(
          item.id
        )}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: trimmedName,
            category,
            unit,
            minimum_stock: minimum,
          }),
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
            "Gagal memperbarui barang. Silakan coba lagi."
        );
      }

      // Close after confirmed success.
      setError("");
      updateOpen(false);

      // Notify parent workspace.
      onSuccess?.();

      // Refresh server-rendered data.
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Terjadi kesalahan saat memperbarui barang."
      );
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
    >
      {/* Trigger */}
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
            className={[
              "h-9 rounded-xl px-3",
              "border-[#8FA58A]/20",
              "bg-white/65",
              "text-[#536D50]",
              "transition-colors",
              "hover:bg-white/90",
              "hover:text-[#343B32]",
            ].join(" ")}
          >
            <Pencil
              aria-hidden="true"
              className="mr-1.5 size-4"
            />
            Edit
          </Button>
        </DialogTrigger>
      )}

      {/* Dialog */}
      <DialogContent
        className={[
          "w-[calc(100%-2rem)]",
          "max-h-[min(90dvh,720px)]",
          "overflow-y-auto",
          "rounded-[26px]",
          "border border-white/60",
          "bg-[#FAF7F0]/95",
          "p-0",
          "shadow-[0_24px_70px_rgba(52,59,50,0.16)]",
          "backdrop-blur-2xl",
          "sm:max-w-[460px]",
        ].join(" ")}
      >
        {/* Header */}
        <DialogHeader className="border-b border-[#8FA58A]/15 px-5 pb-4 pt-6 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#8FA58A]/15 text-[#536D50]">
              <Pencil
                aria-hidden="true"
                className="size-5"
              />
            </span>

            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold tracking-tight text-[#343B32]">
                Edit item
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs leading-relaxed text-[#7A8775]">
                Update your item details and stock
                threshold.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-5 py-5 sm:px-6"
        >
          {/* Item name */}
          <div className="space-y-2">
            <Label
              htmlFor={`edit-name-${item.id}`}
              className={labelClassName}
            >
              Item name
            </Label>

            <Input
              id={`edit-name-${item.id}`}
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              disabled={isSubmitting}
              maxLength={MAX_NAME_LENGTH}
              required
              placeholder="Enter item name"
              className={inputClassName}
            />
          </div>

          {/* Category & Unit */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label
                htmlFor={`edit-category-${item.id}`}
                className={labelClassName}
              >
                Category
              </Label>

              <Select
                value={category}
                onValueChange={setCategory}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id={`edit-category-${item.id}`}
                  className={selectClassName}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="raw_material">
                    Raw material
                  </SelectItem>

                  <SelectItem value="finished_product">
                    Finished product
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-0 space-y-2">
              <Label
                htmlFor={`edit-unit-${item.id}`}
                className={labelClassName}
              >
                Unit
              </Label>

              <Select
                value={unit}
                onValueChange={setUnit}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id={`edit-unit-${item.id}`}
                  className={selectClassName}
                >
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="kg">
                    Kilogram (kg)
                  </SelectItem>

                  <SelectItem value="pcs">
                    Pieces (pcs)
                  </SelectItem>

                  <SelectItem value="liter">
                    Liter
                  </SelectItem>

                  <SelectItem value="gram">
                    Gram
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Minimum stock */}
          <div className="space-y-2">
            <Label
              htmlFor={`edit-minimum-${item.id}`}
              className={labelClassName}
            >
              Minimum stock
            </Label>

            <Input
              id={`edit-minimum-${item.id}`}
              type="number"
              min="0"
              max={MAX_STOCK}
              step="any"
              inputMode="decimal"
              value={minimumStock}
              onChange={(event) =>
                setMinimumStock(event.target.value)
              }
              disabled={isSubmitting}
              required
              placeholder="0"
              className={inputClassName}
            />

            <p className="text-[11px] leading-relaxed text-[#7A8775]">
              This threshold determines when the
              item needs restocking.
            </p>
          </div>

          {/* Stock information */}
          <div className="flex items-start gap-2.5 rounded-xl border border-[#8FA58A]/15 bg-[#8FA58A]/8 p-3">
            <AlertCircle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-[#536D50]"
            />

            <p className="text-xs leading-relaxed text-[#7A8775]">
              Stock quantities cannot be edited here.
              Use Stock Transaction to record
              incoming, outgoing, usage, or waste.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-[#C9857C]/20 bg-[#C9857C]/10 p-3"
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
          <div className="flex flex-col-reverse gap-2 border-t border-[#8FA58A]/15 pt-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() =>
                handleOpenChange(false)
              }
              className={[
                "h-11 rounded-xl",
                "border-[#8FA58A]/20",
                "bg-white/65",
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
              type="submit"
              disabled={isSubmitting}
              className={[
                "h-11 rounded-xl",
                "bg-[#536D50]",
                "px-5 text-white",
                "font-semibold",
                "transition-colors",
                "hover:bg-[#435A40]",
                "disabled:opacity-60",
                "sm:min-w-[150px]",
              ].join(" ")}
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin"
                  />
                  Saving...
                </>
              ) : (
                <>
                  <Check
                    aria-hidden="true"
                    className="mr-1.5 size-4"
                  />
                  Save changes
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
