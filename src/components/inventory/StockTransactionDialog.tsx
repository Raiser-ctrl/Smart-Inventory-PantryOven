
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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

  const selectedItem = items.find(
    (item) => item.id === itemId
  );

  const currentStock = selectedItem
    ? Number(selectedItem.current_stock)
    : 0;

  const amount = Number(quantity) || 0;

  const estimatedStock =
    transactionType === "stock_in"
      ? currentStock + amount
      : currentStock - amount;

  function resetForm() {
    setItemId("");
    setTransactionType("stock_in");
    setQuantity("");
    setNotes("");
    setError("");
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");

    const numericQuantity = Number(quantity);

    if (!itemId) {
      setError("Silakan pilih barang.");
      return;
    }

    if (
      !quantity.trim() ||
      !Number.isFinite(numericQuantity) ||
      numericQuantity <= 0
    ) {
      setError("Jumlah harus lebih besar dari 0.");
      return;
    }

    if (
      transactionType !== "stock_in" &&
      numericQuantity > currentStock
    ) {
      setError("Jumlah melebihi stok yang tersedia.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        "/api/v1/transactions",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_id: itemId,
            transaction_type: transactionType,
            quantity: numericQuantity,
            notes: notes.trim() || null,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "Gagal menyimpan transaksi."
        );
      }

      resetForm();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Terjadi kesalahan."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (loading) return;

        setOpen(nextOpen);

        if (!nextOpen) {
          resetForm();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
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
          <div className="space-y-2">
            <Label htmlFor="transaction-item">
              Barang
            </Label>

            <Select
              value={itemId}
              onValueChange={setItemId}
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

          <div className="space-y-2">
            <Label htmlFor="transaction-type">
              Jenis Transaksi
            </Label>

            <Select
              value={transactionType}
              onValueChange={(value) =>
                setTransactionType(
                  value as TransactionType
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
              min="0.001"
              step="any"
              placeholder="Contoh: 5"
              value={quantity}
              onChange={(event) =>
                setQuantity(event.target.value)
              }
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction-notes">
              Catatan (Opsional)
            </Label>

            <textarea
              id="transaction-notes"
              rows={3}
              maxLength={500}
              value={notes}
              onChange={(event) =>
                setNotes(event.target.value)
              }
              disabled={loading}
              placeholder="Contoh: Restock dari supplier"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {selectedItem && (
            <div className="rounded-lg border p-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span>Stok saat ini</span>
                <strong>
                  {currentStock} {selectedItem.unit}
                </strong>
              </div>

              <div className="flex justify-between">
                <span>Perkiraan stok akhir</span>
                <strong
                  className={
                    estimatedStock < 0
                      ? "text-red-600"
                      : ""
                  }
                >
                  {estimatedStock} {selectedItem.unit}
                </strong>
              </div>
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="text-sm text-red-600"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              disabled={loading || items.length === 0}
            >
              {loading
                ? "Menyimpan..."
                : "Simpan Transaksi"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
