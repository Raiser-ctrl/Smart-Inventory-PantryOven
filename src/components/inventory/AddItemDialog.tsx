
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";

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

type ApiResponse = {
  success: boolean;
  message?: string;
};

export function AddItemDialog() {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [initialStock, setInitialStock] = useState("");
  const [minimumStock, setMinimumStock] = useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setName("");
    setCategory("");
    setUnit("");
    setInitialStock("");
    setMinimumStock("");
    setError("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (isSubmitting) return;

    setOpen(nextOpen);

    if (!nextOpen) {
      resetForm();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) return;

    setError("");

    const trimmedName = name.trim();

    if (!trimmedName || !category || !unit) {
      setError("Lengkapi seluruh informasi barang.");
      return;
    }

    if (trimmedName.length > 150) {
      setError("Nama barang maksimal 150 karakter.");
      return;
    }

    if (
      initialStock.trim() === "" ||
      minimumStock.trim() === ""
    ) {
      setError("Jumlah stok wajib diisi.");
      return;
    }

    const initial = Number(initialStock);
    const minimum = Number(minimumStock);

    if (
      !Number.isFinite(initial) ||
      !Number.isFinite(minimum) ||
      initial < 0 ||
      minimum < 0
    ) {
      setError("Jumlah stok harus berupa angka valid dan tidak negatif.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/items", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          name: trimmedName,
          category,
          unit,
          initial_stock: initial,
          minimum_stock: minimum,
        }),
      });

      const result: ApiResponse = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ?? "Gagal menambahkan barang."
        );
      }

      resetForm();
      setOpen(false);

      // Refresh inventory data in Server Components.
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan barang."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Item</DialogTitle>
          <DialogDescription>
            Enter the details of your bakery inventory item.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item-name">Item Name</Label>
            <Input
              id="item-name"
              placeholder="e.g. Susu Cair"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isSubmitting}
              maxLength={150}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-category">Category</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={isSubmitting}
            >
              <SelectTrigger id="item-category" className="w-full">
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
            <Label htmlFor="item-unit">Unit</Label>
            <Select
              value={unit}
              onValueChange={setUnit}
              disabled={isSubmitting}
            >
              <SelectTrigger id="item-unit" className="w-full">
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="kg">Kilogram (kg)</SelectItem>
                <SelectItem value="pcs">Pieces (pcs)</SelectItem>
                <SelectItem value="liter">Liter</SelectItem>
                <SelectItem value="gram">Gram</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initial-stock">Initial Stock</Label>
              <Input
                id="initial-stock"
                type="number"
                min="0"
                step="any"
                value={initialStock}
                onChange={(event) =>
                  setInitialStock(event.target.value)
                }
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-stock">Minimum Stock</Label>
              <Input
                id="minimum-stock"
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
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving Item...
              </>
            ) : (
              "Save Item"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
