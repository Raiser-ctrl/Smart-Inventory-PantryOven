
"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";

import { useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Package,
  Plus,
  Trash2,
  TrendingDown,
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

import { notifyInventoryUpdated } from "@/lib/inventory-events";

type TransactionType =
  | "stock_in"
  | "stock_out"
  | "usage"
  | "waste";

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
};

type Props = {
  items: InventoryItem[];
};

type ApiResponse = {
  success?: boolean;
  message?: string;
};

type TransactionPayload = {
  item_id: string;
  transaction_type: TransactionType;
  quantity: number;
  notes: string | null;
};

type PendingRequest = {
  key: string;
  payload: string;
};

const MAX_QUANTITY = 1_000_000_000;
const MAX_NOTES_LENGTH = 500;

const VALID_TRANSACTION_TYPES: TransactionType[] = [
  "stock_in",
  "stock_out",
  "usage",
  "waste",
];

const stockFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 6,
});

const inputClassName = [
  "h-11 rounded-xl",
  "border-[#8FA58A]/20",
  "bg-white/70",
  "text-[#343B32]",
  "placeholder:text-[#7A8775]/65",
  "focus-visible:border-[#8FA58A]",
  "focus-visible:ring-[#8FA58A]/25",
].join(" ");

const labelClassName =
  "text-xs font-semibold text-[#536D50]";

const transactionOptions = [
  {
    value: "stock_in" as const,
    label: "Stock in",
    description: "Add stock",
    icon: ArrowDownToLine,
  },
  {
    value: "stock_out" as const,
    label: "Stock out",
    description: "Remove stock",
    icon: ArrowUpFromLine,
  },
  {
    value: "usage" as const,
    label: "Usage",
    description: "Used in production",
    icon: TrendingDown,
  },
  {
    value: "waste" as const,
    label: "Waste",
    description: "Damaged or wasted",
    icon: Trash2,
  },
];

export default function StockTransactionDialog({
  items,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [itemId, setItemId] = useState("");

  const [transactionType, setTransactionType] =
    useState<TransactionType>("stock_in");

  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Prevent simultaneous submissions.
  const submittingRef = useRef(false);

  // Preserve the key for uncertain retries.
  const pendingRequestRef =
    useRef<PendingRequest | null>(null);

  const selectedItem = items.find(
    (item) => item.id === itemId
  );

  const currentStock = selectedItem
    ? Number(selectedItem.current_stock)
    : 0;

  const numericQuantity = Number(quantity);

  const validPreviewQuantity =
    quantity.trim() !== "" &&
    Number.isFinite(numericQuantity) &&
    numericQuantity > 0;

  const previewQuantity = validPreviewQuantity
    ? numericQuantity
    : 0;

  const estimatedStock =
    transactionType === "stock_in"
      ? currentStock + previewQuantity
      : currentStock - previewQuantity;

  const insufficientStock =
    selectedItem !== undefined &&
    transactionType !== "stock_in" &&
    validPreviewQuantity &&
    numericQuantity > currentStock;

  function clearPendingRequest() {
    pendingRequestRef.current = null;
  }

  function resetForm() {
    setItemId("");
    setTransactionType("stock_in");
    setQuantity("");
    setNotes("");
    setError("");

    clearPendingRequest();
  }

  function handleFieldChange(update: () => void) {
    if (submittingRef.current) return;

    clearPendingRequest();
    setError("");
    update();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (submittingRef.current) return;

    setOpen(nextOpen);

    if (!nextOpen) {
      // Preserve the draft when the outcome
      // of a previous request is uncertain.
      if (pendingRequestRef.current) {
        return;
      }

      resetForm();
    }
  }

  function validateForm(): TransactionPayload | null {
    if (!selectedItem) {
      setError("Silakan pilih barang yang valid.");
      return null;
    }

    if (
      !VALID_TRANSACTION_TYPES.includes(
        transactionType
      )
    ) {
      setError("Jenis transaksi tidak valid.");
      return null;
    }

    if (
      quantity.trim() === "" ||
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0 ||
      numericQuantity > MAX_QUANTITY
    ) {
      setError(
        "Jumlah harus lebih besar dari 0 dan maksimal 1.000.000.000."
      );
      return null;
    }

    if (notes.trim().length > MAX_NOTES_LENGTH) {
      setError("Catatan maksimal 500 karakter.");
      return null;
    }

    if (
      transactionType !== "stock_in" &&
      numericQuantity > currentStock
    ) {
      setError(
        "Jumlah melebihi stok yang tersedia."
      );
      return null;
    }

    return {
      item_id: selectedItem.id,
      transaction_type: transactionType,
      quantity: numericQuantity,
      notes: notes.trim() || null,
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
    setLoading(true);

    try {
      const response = await fetch(
        "/api/v1/transactions",
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
        if (
          [400, 409, 415, 422].includes(
            response.status
          )
        ) {
          clearPendingRequest();
        }

        throw new Error(
          result?.message ??
            "Gagal menyimpan transaksi. Silakan coba lagi."
        );
      }

      notifyInventoryUpdated(payload.item_id);

      resetForm();
      setOpen(false);

      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Terjadi kesalahan saat menyimpan transaksi."
      );
    } finally {
      submittingRef.current = false;
      setLoading(false);
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
          variant="outline"
          className={[
            "h-10 rounded-xl px-4",
            "border-[#8FA58A]/25",
            "bg-white/65",
            "text-[#536D50]",
            "transition-colors",
            "hover:bg-white/90",
            "hover:text-[#343B32]",
          ].join(" ")}
        >
          <Plus
            aria-hidden="true"
            className="mr-1.5 size-4"
          />

          Transaction
        </Button>
      </DialogTrigger>

      {/* Dialog */}
      <DialogContent
        className={[
          "w-[calc(100%-2rem)]",
          "max-h-[min(90dvh,800px)]",
          "overflow-y-auto",
          "rounded-[26px]",
          "border border-white/60",
          "bg-[#FAF7F0]/95",
          "p-0",
          "shadow-[0_24px_70px_rgba(52,59,50,0.16)]",
          "backdrop-blur-2xl",
          "sm:max-w-[480px]",
        ].join(" ")}
      >
        {/* Header */}
        <DialogHeader className="border-b border-[#8FA58A]/15 px-5 pb-4 pt-6 text-left sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#8FA58A]/15 text-[#536D50]">
              <Package
                aria-hidden="true"
                className="size-5"
              />
            </span>

            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold tracking-tight text-[#343B32]">
                Stock transaction
              </DialogTitle>

              <DialogDescription className="mt-1 text-xs leading-relaxed text-[#7A8775]">
                Record stock movements for your bakery.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 px-5 py-5 sm:px-6"
        >
          {/* Item */}
          <div className="space-y-2">
            <Label
              htmlFor="transaction-item"
              className={labelClassName}
            >
              Item
            </Label>

            <Select
              value={itemId}
              onValueChange={(value) =>
                handleFieldChange(() =>
                  setItemId(value)
                )
              }
              disabled={loading}
            >
              <SelectTrigger
                id="transaction-item"
                className="h-11 w-full rounded-xl border-[#8FA58A]/20 bg-white/70 text-[#343B32]"
              >
                <SelectValue placeholder="Select an item" />
              </SelectTrigger>

              <SelectContent>
                {items.map((item) => (
                  <SelectItem
                    key={item.id}
                    value={item.id}
                  >
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction type */}
          <div className="space-y-2">
            <Label className={labelClassName}>
              Transaction type
            </Label>

            <div
              role="group"
              aria-label="Transaction type"
              className="grid grid-cols-2 gap-2"
            >
              {transactionOptions.map((option) => {
                const Icon = option.icon;

                const selected =
                  transactionType === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    disabled={loading}
                    onClick={() =>
                      handleFieldChange(() =>
                        setTransactionType(
                          option.value
                        )
                      )
                    }
                    className={[
                      "flex min-w-0 items-center gap-2",
                      "rounded-xl border p-3",
                      "text-left transition-colors",
                      "focus-visible:outline-2",
                      "focus-visible:outline-offset-2",
                      "focus-visible:outline-[#8FA58A]",
                      "disabled:opacity-50",
                      selected
                        ? "border-[#8FA58A]/50 bg-[#8FA58A]/15 text-[#536D50]"
                        : "border-[#8FA58A]/15 bg-white/55 text-[#7A8775] hover:bg-white/80",
                    ].join(" ")}
                  >
                    <Icon
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />

                    <span className="min-w-0">
                      <span className="block text-xs font-semibold">
                        {option.label}
                      </span>

                      <span className="mt-0.5 block text-[10px] leading-tight opacity-75">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label
              htmlFor="transaction-quantity"
              className={labelClassName}
            >
              Quantity
              {selectedItem
                ? ` (${selectedItem.unit})`
                : ""}
            </Label>

            <Input
              id="transaction-quantity"
              type="number"
              min="0"
              max={MAX_QUANTITY}
              step="any"
              inputMode="decimal"
              placeholder="e.g. 5"
              value={quantity}
              onChange={(event) =>
                handleFieldChange(() =>
                  setQuantity(event.target.value)
                )
              }
              disabled={loading}
              required
              className={inputClassName}
            />
          </div>

          {/* Stock preview */}
          {selectedItem && (
            <div className="rounded-2xl border border-[#8FA58A]/15 bg-[#8FA58A]/8 p-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-[#7A8775]">
                  Current stock
                </span>

                <span className="text-xs font-medium tabular-nums text-[#343B32]">
                  {stockFormatter.format(
                    currentStock
                  )}{" "}
                  {selectedItem.unit}
                </span>
              </div>

              <div className="my-2.5 h-px bg-[#8FA58A]/15" />

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-[#536D50]">
                  Estimated stock
                </span>

                <span
                  className={`text-sm font-semibold tabular-nums ${
                    insufficientStock
                      ? "text-[#B76F67]"
                      : "text-[#536D50]"
                  }`}
                >
                  {stockFormatter.format(
                    estimatedStock
                  )}{" "}
                  {selectedItem.unit}
                </span>
              </div>

              {insufficientStock && (
                <p className="mt-2 text-[11px] text-[#B76F67]">
                  Quantity exceeds available stock.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label
                htmlFor="transaction-notes"
                className={labelClassName}
              >
                Notes
              </Label>

              <span className="text-[11px] text-[#7A8775]">
                Optional
              </span>
            </div>

            <textarea
              id="transaction-notes"
              rows={2}
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              onChange={(event) =>
                handleFieldChange(() =>
                  setNotes(event.target.value)
                )
              }
              disabled={loading}
              placeholder="e.g. Restock from supplier"
              className={[
                "w-full resize-none rounded-xl",
                "border border-[#8FA58A]/20",
                "bg-white/70 px-3 py-2.5",
                "text-sm text-[#343B32]",
                "placeholder:text-[#7A8775]/65",
                "outline-none",
                "focus-visible:ring-2",
                "focus-visible:ring-[#8FA58A]/25",
                "disabled:opacity-50",
              ].join(" ")}
            />
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
          <div className="border-t border-[#8FA58A]/15 pt-4">
            <Button
              type="submit"
              disabled={
                loading ||
                items.length === 0
              }
              className={[
                "h-11 w-full rounded-xl",
                "bg-[#536D50] text-white",
                "font-semibold",
                "transition-colors",
                "hover:bg-[#435A40]",
                "disabled:opacity-60",
              ].join(" ")}
            >
              {loading ? (
                <>
                  <Loader2
                    aria-hidden="true"
                    className="mr-2 size-4 animate-spin"
                  />
                  Saving transaction...
                </>
              ) : (
                "Save transaction"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
