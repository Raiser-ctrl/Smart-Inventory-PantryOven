
"use client";

import {
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // Prevent simultaneous submissions synchronously.
  const submittingRef = useRef(false);

  // Reuse the same UUID when retrying
  // an identical logical transaction.
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

  function handleFieldChange(
    update: () => void
  ) {
    if (submittingRef.current) return;

    // Changing any field creates a new logical request.
    clearPendingRequest();
    setError("");
    update();
  }

  function handleOpenChange(nextOpen: boolean) {
    if (submittingRef.current) return;

    setOpen(nextOpen);

    if (!nextOpen) {
      // Preserve the draft and key when a previous
      // request has an uncertain outcome.
      if (pendingRequestRef.current) {
        return;
      }

      resetForm();
    }
  }

  function validateForm():
    | TransactionPayload
    | null {
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

    if (
      notes.trim().length > MAX_NOTES_LENGTH
    ) {
      setError(
        "Catatan maksimal 500 karakter."
      );
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

    const serializedPayload = JSON.stringify(payload);

    const previousRequest =
      pendingRequestRef.current;

    // An identical retry must reuse its UUID.
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
        // A definite validation/conflict failure
        // should not reuse the previous request.
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

      // Server confirmed creation or idempotent replay.
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
      <DialogTrigger asChild>
        <Button type="button">
          + Catat Transaksi
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            Catat Transaksi Stok
          </DialogTitle>

          <DialogDescription>
            Catat stok masuk, stok keluar,
            penggunaan, atau bahan terbuang.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Item */}
          <div className="space-y-2">
            <Label htmlFor="transaction-item">
              Barang
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
                className="w-full"
              >
                <SelectValue placeholder="Pilih barang" />
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

          {/* Transaction Type */}
          <div className="space-y-2">
            <Label htmlFor="transaction-type">
              Jenis Transaksi
            </Label>

            <Select
              value={transactionType}
              onValueChange={(value) =>
                handleFieldChange(() =>
                  setTransactionType(
                    value as TransactionType
                  )
                )
              }
              disabled={loading}
            >
              <SelectTrigger
                id="transaction-type"
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="stock_in">
                  Stock In
                </SelectItem>

                <SelectItem value="stock_out">
                  Stock Out
                </SelectItem>

                <SelectItem value="usage">
                  Usage
                </SelectItem>

                <SelectItem value="waste">
                  Waste
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="transaction-quantity">
              Jumlah
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
              placeholder="Contoh: 5"
              value={quantity}
              onChange={(event) =>
                handleFieldChange(() =>
                  setQuantity(event.target.value)
                )
              }
              disabled={loading}
              required
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="transaction-notes">
              Catatan (Opsional)
            </Label>

            <textarea
              id="transaction-notes"
              rows={3}
              maxLength={MAX_NOTES_LENGTH}
              value={notes}
              onChange={(event) =>
                handleFieldChange(() =>
                  setNotes(event.target.value)
                )
              }
              disabled={loading}
              placeholder="Contoh: Restock dari supplier"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Stock Preview */}
          {selectedItem && (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex justify-between gap-3">
                <span>Stok saat ini</span>

                <strong className="tabular-nums">
                  {stockFormatter.format(
                    currentStock
                  )}{" "}
                  {selectedItem.unit}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span>Perkiraan stok akhir</span>

                <strong
                  className={`tabular-nums ${
                    estimatedStock < 0
                      ? "text-destructive"
                      : ""
                  }`}
                >
                  {stockFormatter.format(
                    estimatedStock
                  )}{" "}
                  {selectedItem.unit}
                </strong>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}

          {/* Submit */}
          <DialogFooter>
            <Button
              type="submit"
              disabled={
                loading ||
                items.length === 0
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Transaksi"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
