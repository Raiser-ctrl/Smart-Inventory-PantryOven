
"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";
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

const MAX_STOCK = 1_000_000_000;
const MAX_NAME_LENGTH = 150;

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

type ApiResponse = {
  success?: boolean;
  message?: string;
};

type ItemPayload = {
  name: string;
  category: string;
  unit: string;
  initial_stock: number;
  minimum_stock: number;
};

type PendingRequest = {
  key: string;
  payload: string;
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

  // Synchronous guard against double submission.
  const submittingRef = useRef(false);

  // Keep the same key when retrying an uncertain request.
  const pendingRequestRef =
    useRef<PendingRequest | null>(null);

  function clearPendingRequest() {
    pendingRequestRef.current = null;
  }

  function resetForm() {
    setName("");
    setCategory("");
    setUnit("");
    setInitialStock("");
    setMinimumStock("");
    setError("");
    clearPendingRequest();
  }

  function handleFieldChange(
    setter: (value: string) => void,
    value: string
  ) {
    if (submittingRef.current) return;

    // A changed form represents a new logical request.
    clearPendingRequest();
    setError("");
    setter(value);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (submittingRef.current) return;

    setOpen(nextOpen);

    if (!nextOpen) {
      // Preserve the draft if the previous request
      // may have reached the server.
      if (pendingRequestRef.current) {
        return;
      }

      resetForm();
    }
  }

  function validateForm(): ItemPayload | null {
    const trimmedName = name.trim();

    if (
      !trimmedName ||
      trimmedName.length > MAX_NAME_LENGTH
    ) {
      setError(
        "Nama barang wajib diisi dan maksimal 150 karakter."
      );
      return null;
    }

    if (
      !VALID_CATEGORIES.some(
        (value) => value === category
      )
    ) {
      setError("Silakan pilih kategori yang valid.");
      return null;
    }

    if (
      !VALID_UNITS.some(
        (value) => value === unit
      )
    ) {
      setError("Silakan pilih satuan yang valid.");
      return null;
    }

    if (
      initialStock.trim() === "" ||
      minimumStock.trim() === ""
    ) {
      setError(
        "Stok awal dan stok minimum wajib diisi."
      );
      return null;
    }

    const initial = Number(initialStock);
    const minimum = Number(minimumStock);

    if (
      !Number.isFinite(initial) ||
      !Number.isFinite(minimum) ||
      initial < 0 ||
      minimum < 0 ||
      initial > MAX_STOCK ||
      minimum > MAX_STOCK
    ) {
      setError(
        "Stok harus berupa angka antara 0 dan 1.000.000.000."
      );
      return null;
    }

    return {
      name: trimmedName,
      category,
      unit,
      initial_stock: initial,
      minimum_stock: minimum,
    };
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (submittingRef.current) return;

    setError("");

    const payload = validateForm();

    if (!payload) return;

    const serializedPayload = JSON.stringify(payload);

    // Reuse the UUID only for an identical payload.
    const previousRequest = pendingRequestRef.current;

    const idempotencyKey =
      previousRequest?.payload === serializedPayload
        ? previousRequest.key
        : crypto.randomUUID();

    pendingRequestRef.current = {
      key: idempotencyKey,
      payload: serializedPayload,
    };

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/v1/items", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...payload,
          idempotency_key: idempotencyKey,
        }),
      });

      const result: ApiResponse | null =
        await response.json().catch(() => null);

      if (!response.ok || result?.success !== true) {
        // A validation or key conflict means this
        // attempt should not be reused.
        if (
          [400, 409, 415, 422].includes(response.status)
        ) {
          clearPendingRequest();
        }

        throw new Error(
          result?.message ??
            "Gagal menambahkan barang. Silakan coba lagi."
        );
      }

      // The server confirmed creation or replay.
      resetForm();
      setOpen(false);

      // Refresh inventory Server Components.
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Terjadi kesalahan saat menyimpan barang."
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
      <DialogTrigger asChild>
        <Button type="button">
          <Plus className="mr-2 h-4 w-4" />
          Add Item
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Add New Item
          </DialogTitle>

          <DialogDescription>
            Enter the details of your bakery inventory item.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Item Name */}
          <div className="space-y-2">
            <Label htmlFor="item-name">
              Item Name
            </Label>

            <Input
              id="item-name"
              placeholder="e.g. Susu Cair"
              value={name}
              onChange={(event) =>
                handleFieldChange(
                  setName,
                  event.target.value
                )
              }
              disabled={isSubmitting}
              maxLength={MAX_NAME_LENGTH}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="item-category">
              Category
            </Label>

            <Select
              value={category}
              onValueChange={(value) =>
                handleFieldChange(
                  setCategory,
                  value
                )
              }
              disabled={isSubmitting}
            >
              <SelectTrigger
                id="item-category"
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
            <Label htmlFor="item-unit">
              Unit
            </Label>

            <Select
              value={unit}
              onValueChange={(value) =>
                handleFieldChange(
                  setUnit,
                  value
                )
              }
              disabled={isSubmitting}
            >
              <SelectTrigger
                id="item-unit"
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

          {/* Stock Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initial-stock">
                Initial Stock
              </Label>

              <Input
                id="initial-stock"
                type="number"
                min="0"
                max={MAX_STOCK}
                step="any"
                value={initialStock}
                onChange={(event) =>
                  handleFieldChange(
                    setInitialStock,
                    event.target.value
                  )
                }
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="minimum-stock">
                Minimum Stock
              </Label>

              <Input
                id="minimum-stock"
                type="number"
                min="0"
                max={MAX_STOCK}
                step="any"
                value={minimumStock}
                onChange={(event) =>
                  handleFieldChange(
                    setMinimumStock,
                    event.target.value
                  )
                }
                disabled={isSubmitting}
                required
              />
            </div>
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

          {/* Submit Button */}
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
