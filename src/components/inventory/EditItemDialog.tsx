
"use client";

import { useState, type FormEvent } from "react";
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
  success: boolean;
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

  const open = controlledOpen ?? internalOpen;

  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState(item.unit);
  const [minimumStock, setMinimumStock] = useState(
    String(item.minimum_stock)
  );

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setName(item.name);
    setCategory(item.category);
    setUnit(item.unit);
    setMinimumStock(String(item.minimum_stock));
    setError("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return;

    if (nextOpen) {
      resetForm();
    }

    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      setError("");
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");

    const trimmedName = name.trim();
    const minimum = Number(minimumStock);

    if (!trimmedName || trimmedName.length > 150) {
      setError(
        "Nama barang wajib diisi, maksimal 150 karakter."
      );
      return;
    }

    if (
      !["raw_material", "finished_product"].includes(
        category
      ) ||
      !["kg", "pcs", "liter", "gram"].includes(unit)
    ) {
      setError("Kategori atau satuan tidak valid.");
      return;
    }

    if (
      minimumStock.trim() === "" ||
      !Number.isFinite(minimum) ||
      minimum < 0
    ) {
      setError(
        "Minimum stok harus berupa angka tidak negatif."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/v1/items/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            name: trimmedName,
            category,
            unit,
            minimum_stock: minimum,
          }),
        }
      );

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ?? "Gagal memperbarui barang."
        );
      }

      handleOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat memperbarui barang."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Item</DialogTitle>
          <DialogDescription>
            Update item information. Stock changes must be
            recorded through Stock Transaction.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              maxLength={150}
              required
            />
          </div>

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

          <div className="space-y-2">
            <Label htmlFor={`edit-minimum-${item.id}`}>
              Minimum Stock
            </Label>
            <Input
              id={`edit-minimum-${item.id}`}
              type="number"
              min="0"
              step="any"
              value={minimumStock}
              onChange={(event) =>
                setMinimumStock(event.target.value)
              }
              disabled={isSubmitting}
              required
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={isSubmitting}>
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
