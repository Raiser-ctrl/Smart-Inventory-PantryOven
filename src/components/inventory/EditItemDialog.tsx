
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";

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

export function EditItemDialog({
  item,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  onSuccess,
}: Props) {
  const router = useRouter();

  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled
    ? controlledOpen
    : internalOpen;

  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [minimumStock, setMinimumStock] = useState(
    String(item.minimum_stock)
  );

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchronous protection against duplicate requests.
  const submittingRef = useRef(false);

  // Track dialog transitions and the selected item.
  const previousOpenRef = useRef(open);
  const previousItemIdRef = useRef(item.id);

  function resetForm() {
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setMinimumStock(String(item.minimum_stock));
    setError("");
  }

  // Synchronize form when the controlled dialog opens
  // or the selected item changes.
  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    const previousItemId = previousItemIdRef.current;

    const justOpened = open && !wasOpen;
    const itemChanged = item.id !== previousItemId;

    if (
      open &&
      (justOpened || itemChanged) &&
      !submittingRef.current
    ) {
      setName(item.name);
      setCategory(item.category);
      setUnit(item.unit);
      setMinimumStock(String(item.minimum_stock));
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
        `/api/v1/items/${encodeURIComponent(item.id)}`,
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

      if (!response.ok || result?.success !== true) {
        throw new Error(
          result?.message ??
            "Gagal memperbarui barang. Silakan coba lagi."
        );
      }

      // Close directly after confirmed success.
      // Do not call handleOpenChange(false) here:
      // its submitting guard would block closing.
      setError("");
      updateOpen(false);

      // Notify parent workspace.
      onSuccess?.();

      // Refresh Server Components inventory data.
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
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSubmitting}
          >
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Edit Item
          </DialogTitle>

          <DialogDescription>
            Update item information. Stock changes must be
            recorded through Stock Transaction.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Item Name */}
          <div className="space-y-2">
            <Label htmlFor={`edit-name-${item.id}`}>
              Item Name
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
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor={`edit-category-${item.id}`}>
              Category
            </Label>

            <Select
              value={category}
              onValueChange={setCategory}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id={`edit-category-${item.id}`}
                className="w-full"
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="raw_material">
                  Raw Material
                </SelectItem>

                <SelectItem value="finished_product">
                  Finished Product
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Unit */}
          <div className="space-y-2">
            <Label htmlFor={`edit-unit-${item.id}`}>
              Unit
            </Label>

            <Select
              value={unit}
              onValueChange={setUnit}
              disabled={isSubmitting}
            >
              <SelectTrigger
                id={`edit-unit-${item.id}`}
                className="w-full"
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

          {/* Minimum Stock */}
          <div className="space-y-2">
            <Label htmlFor={`edit-minimum-${item.id}`}>
              Minimum Stock
            </Label>

            <Input
              id={`edit-minimum-${item.id}`}
              type="number"
              min="0"
              max={MAX_STOCK}
              step="any"
              value={minimumStock}
              onChange={(event) =>
                setMinimumStock(event.target.value)
              }
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Error Message */}
          {error && (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
