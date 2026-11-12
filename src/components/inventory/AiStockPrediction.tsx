
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type InventoryOption = {
  id: string;
  name: string;
  unit: string;
};

type StockStatus = "Restock" | "Sufficient" | "Excess";

type PredictionResult = {
  item: {
    id: string;
    name: string;
    category: string;
    unit: string;
  };
  features: {
    current_stock: number;
    minimum_stock: number;
    average_daily_usage: number;
    average_daily_waste: number;
    lead_time_days: number;
  };
  prediction: {
    stock_status: StockStatus;
    model_stock_status: StockStatus;
    confidence: number;
    probabilities: Record<StockStatus, number>;
    model_type: string;
    dataset_type: string;
    safety_override: boolean;
  };
  data_quality: {
    level: "insufficient" | "limited" | "adequate";
    window_days: number;
    usage_transactions: number;
    waste_transactions: number;
    total_consumption_transactions: number;
    distinct_usage_days: number;
    minimum_usage_transactions: number;
    minimum_usage_days: number;
    has_recent_usage: boolean;
    has_recent_waste: boolean;
    limited_history_warning: string | null;
  };
  calculated_at: string;
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  data?: PredictionResult;
};

type Props = {
  items: InventoryOption[];
};

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("id-ID", {
  style: "percent",
  maximumFractionDigits: 1,
});

const statusStyles: Record<StockStatus, string> = {
  Restock:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Sufficient:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Excess:
    "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

export default function AiStockPrediction({
  items,
}: Props) {
  const [itemId, setItemId] = useState("");
  const [leadTime, setLeadTime] = useState("3");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] =
    useState<PredictionResult | null>(null);

  const requestRef = useRef<AbortController | null>(
    null
  );
  const requestIdRef = useRef(0);

  const selectedItemExists = items.some(
    (item) => item.id === itemId
  );

  const leadTimeNumber = Number(leadTime);

  const validLeadTime =
    leadTime.trim() !== "" &&
    Number.isSafeInteger(leadTimeNumber) &&
    leadTimeNumber >= 1 &&
    leadTimeNumber <= 365;

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  function invalidatePrediction() {
    requestIdRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;

    setLoading(false);
    setResult(null);
    setError("");
  }

  async function handlePredict(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      loading ||
      !selectedItemExists ||
      !validLeadTime
    ) {
      return;
    }

    invalidatePrediction();

    const requestId = requestIdRef.current;
    const controller = new AbortController();

    requestRef.current = controller;
    setLoading(true);

    try {
      const response = await fetch(
        "/api/v1/ai/predict",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_id: itemId,
            lead_time_days: leadTimeNumber,
          }),
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const payload: ApiResponse =
        await response.json();

      if (
        !response.ok ||
        payload.success !== true ||
        !payload.data
      ) {
        throw new Error(
          payload.message ??
            "Gagal mendapatkan prediksi stok."
        );
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setResult(payload.data);
    } catch (caughtError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      if (controller.signal.aborted) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Terjadi kesalahan saat memproses prediksi."
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        requestRef.current = null;
      }
    }
  }

  return (
    <section
      aria-labelledby="ai-stock-title"
      className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="size-5" />
          </div>

          <div>
            <h2
              id="ai-stock-title"
              className="text-base font-semibold tracking-tight sm:text-lg"
            >
              AI Stock Prediction
            </h2>

            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Analyze stock conditions using inventory
              data and recent usage history.
            </p>
          </div>
        </div>

        <Badge variant="secondary">
          <Sparkles className="mr-1 size-3" />
          Machine Learning
        </Badge>
      </div>

      <form
        onSubmit={handlePredict}
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end"
      >
        <div className="min-w-0 space-y-1.5">
          <label
            htmlFor="ai-stock-item"
            className="text-xs font-medium"
          >
            Inventory item
          </label>

          <select
            id="ai-stock-item"
            value={itemId}
            disabled={loading || items.length === 0}
            onChange={(event) => {
              invalidatePrediction();
              setItemId(event.target.value);
            }}
            className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">
              Select an active item
            </option>

            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} ({item.unit})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="ai-lead-time"
            className="text-xs font-medium"
          >
            Lead time (days)
          </label>

          <input
            id="ai-lead-time"
            type="number"
            min={1}
            max={365}
            step={1}
            value={leadTime}
            disabled={loading}
            onChange={(event) => {
              invalidatePrediction();
              setLeadTime(event.target.value);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <Button
          type="submit"
          disabled={
            loading ||
            !selectedItemExists ||
            !validLeadTime
          }
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Predicting...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              Predict Stock
            </>
          )}
        </Button>
      </form>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No active inventory items available.
        </p>
      )}

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div
          aria-live="polite"
          className="space-y-4 border-t pt-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">
                Prediction result
              </p>
              <p className="font-semibold">
                {result.item.name}
              </p>
            </div>

            <Badge
              variant="outline"
              className={
                statusStyles[
                  result.prediction.stock_status
                ]
              }
            >
              {result.prediction.stock_status}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Current stock
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {numberFormatter.format(
                  result.features.current_stock
                )}{" "}
                {result.item.unit}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Minimum stock
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {numberFormatter.format(
                  result.features.minimum_stock
                )}{" "}
                {result.item.unit}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Model confidence
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums">
                {percentFormatter.format(
                  result.prediction.confidence
                )}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              Model probabilities
            </h3>

            {(
              [
                "Restock",
                "Sufficient",
                "Excess",
              ] as const
            ).map((status) => {
              const probability =
                result.prediction.probabilities[
                  status
                ] ?? 0;

              return (
                <div
                  key={status}
                  className="space-y-1"
                >
                  <div className="flex justify-between gap-2 text-xs">
                    <span>{status}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {percentFormatter.format(
                        probability
                      )}
                    </span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${
                          Math.max(
                            0,
                            Math.min(1, probability)
                          ) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">
                Data quality
              </h3>

              <Badge
                variant="outline"
                className={
                  result.data_quality.level ===
                  "adequate"
                    ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : "border-amber-500/30 text-amber-700 dark:text-amber-400"
                }
              >
                {result.data_quality.level}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">
              {result.data_quality.usage_transactions}{" "}
              usage transactions across{" "}
              {result.data_quality.distinct_usage_days}{" "}
              distinct days in the last{" "}
              {result.data_quality.window_days} days.
            </p>

            {result.data_quality
              .limited_history_warning && (
              <div
                role="status"
                className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400"
              >
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {
                    result.data_quality
                      .limited_history_warning
                  }
                </span>
              </div>
            )}

            {result.data_quality.level ===
              "adequate" && (
              <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                Usage history meets the initial
                coverage thresholds.
              </p>
            )}
          </div>

          {result.prediction.safety_override && (
            <div
              role="alert"
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
            >
              Operational safety rule applied:
              current stock is at or below the
              minimum threshold. Final status is
              Restock.
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted-foreground">
            Predictions use a model trained on
            synthetic rule-labeled data.
            Probabilities are not calibrated
            reliability estimates. Always review
            stock decisions manually.
          </p>
        </div>
      )}
    </section>
  );
}
