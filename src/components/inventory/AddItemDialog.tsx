
"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import {
  AlertCircle,
  Loader2,
  PackagePlus,
  Plus,
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

export function AddItemDialog() {
  const router = useRouter();

  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");

  const [initialStock, setInitialStock] =
    useState("");

  const [minimumStock, setMinimumStock] =
    useState("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);

  // Prevent duplicate submissions synchronously.
  const submittingRef = useRef(false);

  // Preserve the key for retries of uncertain requests.
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

    // A changed form represents a new request.
    clearPendingRequest();
    setError("");
    setter(value);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (submittingRef.current) return;

    setOpen(nextOpen);

    if (!nextOpen) {
      // Preserve draft if a previous request may
      // already have reached the server.
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

    const serializedPayload =
      JSON.stringify(payload);

    // Reuse the same UUID for an identical retry.
    const previousRequest =
      pendingRequestRef.current;

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
      const response = await fetch(
        "/api/v1/items",
        {
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
        }
      );

      const result: ApiResponse | null =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        result?.success !== true
      ) {
        // A definite validation/key conflict
        // should not reuse the previous key.
        if (
          [400, 409, 415, 422].includes(
            response.status
          )
        ) {
          clearPendingRequest();
        }

        throw new Error(
          result?.message ??
            "Gagal menambahkan barang. Silakan coba lagi."
        );
      }

      resetForm();
      setOpen(false);

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
      {/* Trigger */}
      <DialogTrigger asChild>
        <Button
          type="button"
          className={[
            "h-10 rounded-xl px-4",
            "bg-[#536D50] text-white",
            "shadow-[0_4px_12px_rgba(83,109,80,0.12)]",
            "transition-colors",
            "hover:bg-[#435A40]",
            "focus-visible:ring-[#8FA58A]/40",
          ].join(" ")}
        >
          <Plus
            aria-hidden="true"
            className="mr-1.5 size-4"
          />

          Add Item
        </Button>
      </DialogTrigger>

      {/* Dialog */}
      <DialogContent
        className={[
          "w-[calc(100%-2rem)]",
          "max-h-[min(90dvh,760px)]",
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
        <DialogHeader className="border-b border-[#8FA58A]/12 px-5 pb-4 pt-6 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#8FA58A]/15 text-[#536D50]">
              <PackagePlus
                aria-hidden="true"
                className="size-5"
              />
            </span>

            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold tracking-tight text-[#343B32]">
                Add new item
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs leading-relaxed text-[#7A8775]">
                Add an ingredient or product to your
                bakery inventory.
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
              htmlFor="item-name"
              className={labelClassName}
            >
              Item name
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
              className={inputClassName}
            />
          </div>

          {/* Category & unit */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label
                htmlFor="item-category"
                className={labelClassName}
              >
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
                htmlFor="item-unit"
                className={labelClassName}
              >
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

          {/* Stock values */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[#536D50]">
                Stock settings
              </p>

              <span className="text-[11px] text-[#7A8775]">
                In selected unit
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0 space-y-2">
                <Label
                  htmlFor="initial-stock"
                  className={labelClassName}
                >
                  Initial stock
                </Label>

                <Input
                  id="initial-stock"
                  type="number"
                  min="0"
                  max={MAX_STOCK}
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  value={initialStock}
                  onChange={(event) =>
                    handleFieldChange(
                      setInitialStock,
                      event.target.value
                    )
                  }
                  disabled={isSubmitting}
                  required
                  className={inputClassName}
                />
              </div>

              <div className="min-w-0 space-y-2">
                <Label
                  htmlFor="minimum-stock"
                  className={labelClassName}
                >
                  Minimum stock
                </Label>

                <Input
                  id="minimum-stock"
                  type="number"
                  min="0"
                  max={MAX_STOCK}
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  value={minimumStock}
                  onChange={(event) =>
                    handleFieldChange(
                      setMinimumStock,
                      event.target.value
                    )
                  }
                  disabled={isSubmitting}
                  required
                  className={inputClassName}
                />
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-[#7A8775]">
              Minimum stock determines when an item
              needs restocking.
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

          {/* Submit */}
          <div className="flex items-center justify-end border-t border-[#8FA58A]/12 pt-4">
            <Button
              type="submit"
              disabled={isSubmitting}
              className={[
                "h-11 w-full rounded-xl",
                "bg-[#536D50] text-white",
                "font-semibold",
                "transition-colors",
                "hover:bg-[#435A40]",
                "disabled:opacity-60",
              ].join(" ")}
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin"
                  />
                  Saving item...
                </>
              ) : (
                <>
                  <Plus
                    aria-hidden="true"
                    className="mr-2 size-4"
                  />
                  Save item
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
