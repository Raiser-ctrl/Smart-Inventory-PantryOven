
"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  AlertCircle,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Loader2,
  Package,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { INVENTORY_UPDATED_EVENT } from "@/lib/inventory-events";

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

const inputClassName = [
  "h-11 w-full min-w-0 rounded-xl",
  "border border-[#8FA58A]/20",
  "bg-white/70 px-3",
  "text-sm text-[#343B32]",
  "outline-none transition-colors",
  "focus-visible:border-[#8FA58A]",
  "focus-visible:ring-2",
  "focus-visible:ring-[#8FA58A]/20",
  "disabled:cursor-not-allowed",
  "disabled:opacity-50",
].join(" ");

const labelClassName =
  "text-xs font-semibold text-[#536D50]";

const statusConfig = {
  Restock: {
    label: "Restock",
    icon: AlertTriangle,
    className:
      "border-[#D4AC72]/30 bg-[#D4AC72]/15 text-[#A77D3D]",
    barClassName: "bg-[#D4AC72]",
  },
  Sufficient: {
    label: "Sufficient",
    icon: CheckCircle2,
    className:
      "border-[#8FA58A]/30 bg-[#8FA58A]/15 text-[#536D50]",
    barClassName: "bg-[#8FA58A]",
  },
  Excess: {
    label: "Excess",
    icon: Package,
    className:
      "border-[#8A9EB6]/30 bg-[#8A9EB6]/15 text-[#607D9C]",
    barClassName: "bg-[#8A9EB6]",
  },
} satisfies Record<
  StockStatus,
  {
    label: string;
    icon: typeof AlertTriangle;
    className: string;
    barClassName: string;
  }
>;

const STOCK_STATUSES: StockStatus[] = [
  "Restock",
  "Sufficient",
  "Excess",
];

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function clampProbability(value: number) {
  if (!Number.isFinite(value)) return 0;

  return Math.max(0, Math.min(1, value));
}

function MetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#F8F6EF]/75 p-3">
      <p className="text-[11px] text-[#7A8775]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold tabular-nums text-[#343B32] sm:text-base">
        {value}
      </p>

      {unit && (
        <p className="mt-0.5 text-[10px] text-[#7A8775]">
          {unit}
        </p>
      )}
    </div>
  );
}

export default function AiStockPrediction({
  items,
}: Props) {
  const [itemId, setItemId] = useState("");
  const [leadTime, setLeadTime] = useState("3");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] =
    useState<PredictionResult | null>(null);

  const [detailsOpen, setDetailsOpen] =
    useState(false);

  const requestRef =
    useRef<AbortController | null>(null);

  const requestIdRef = useRef(0);
  const submittingRef = useRef(false);

  const selectedItem = items.find(
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
      requestIdRef.current += 1;
      requestRef.current?.abort();
      requestRef.current = null;
      submittingRef.current = false;
    };
  }, []);

  function invalidatePrediction() {
    requestIdRef.current += 1;

    requestRef.current?.abort();
    requestRef.current = null;

    submittingRef.current = false;

    setLoading(false);
    setResult(null);
    setError("");
    setDetailsOpen(false);
  }

  useEffect(() => {
    function handleInventoryUpdated() {
      invalidatePrediction();
    }

    window.addEventListener(
      INVENTORY_UPDATED_EVENT,
      handleInventoryUpdated
    );

    return () => {
      window.removeEventListener(
        INVENTORY_UPDATED_EVENT,
        handleInventoryUpdated
      );
    };
  }, []);

  async function handlePredict(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      submittingRef.current ||
      !selectedItem ||
      !validLeadTime
    ) {
      return;
    }

    invalidatePrediction();

    const requestId = requestIdRef.current;
    const controller = new AbortController();

    requestRef.current = controller;
    submittingRef.current = true;

    setLoading(true);

    try {
      const response = await fetch(
        "/api/v1/ai/predict",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_id: selectedItem.id,
            lead_time_days: leadTimeNumber,
          }),
          signal: controller.signal,
        }
      );

      const payload: ApiResponse | null =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        payload?.success !== true ||
        !payload.data
      ) {
        throw new Error(
          payload?.message ??
            "Gagal mendapatkan prediksi stok."
        );
      }

      const prediction = payload.data;

      if (
        !STOCK_STATUSES.includes(
          prediction.prediction.stock_status
        )
      ) {
        throw new Error(
          "Status prediksi dari server tidak valid."
        );
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setResult(prediction);
    } catch (caughtError) {
      if (
        requestId !== requestIdRef.current ||
        controller.signal.aborted
      ) {
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Terjadi kesalahan saat memproses prediksi."
      );
    } finally {
      if (requestId === requestIdRef.current) {
        submittingRef.current = false;
        setLoading(false);
        requestRef.current = null;
      }
    }
  }

  const currentStatus = result
    ? statusConfig[result.prediction.stock_status]
    : null;

  const StatusIcon =
    currentStatus?.icon ?? Package;

  const qualityIsAdequate =
    result?.data_quality.level === "adequate";

  return (
    <section
      aria-labelledby="ai-stock-title"
      className={[
        "min-w-0 overflow-hidden",
        "rounded-[24px]",
        "border border-white/55",
        "bg-white/45",
        "shadow-[0_10px_36px_rgba(52,59,50,0.045)]",
        "backdrop-blur-xl",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pb-4 pt-5 sm:px-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#8FA58A]/15 text-[#536D50]">
          <BrainCircuit
            aria-hidden="true"
            className="size-5"
          />
        </span>

        <div className="min-w-0">
          <h2
            id="ai-stock-title"
            className="text-base font-semibold tracking-tight text-[#343B32]"
          >
            AI Stock Prediction
          </h2>

          <p className="mt-1 text-xs leading-relaxed text-[#7A8775]">
            Predict stock conditions using machine
            learning and recent inventory history.
          </p>
        </div>
      </div>

      {/* Prediction form */}
      <form
        onSubmit={handlePredict}
        className={[
          "grid gap-3",
          "border-t border-[#8FA58A]/10",
          "px-4 py-4 sm:px-5",
          "sm:grid-cols-[minmax(0,1fr)_130px_auto]",
          "sm:items-end",
        ].join(" ")}
      >
        <div className="min-w-0 space-y-2">
          <label
            htmlFor="ai-stock-item"
            className={labelClassName}
          >
            Inventory item
          </label>

          <select
            id="ai-stock-item"
            value={itemId}
            disabled={
              loading || items.length === 0
            }
            onChange={(event) => {
              invalidatePrediction();
              setItemId(event.target.value);
            }}
            className={inputClassName}
          >
            <option value="">
              Select an item
            </option>

            {items.map((item) => (
              <option
                key={item.id}
                value={item.id}
              >
                {item.name} ({item.unit})
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0 space-y-2">
          <label
            htmlFor="ai-lead-time"
            className={labelClassName}
          >
            Lead time (days)
          </label>

          <input
            id="ai-lead-time"
            type="number"
            min={1}
            max={365}
            step={1}
            inputMode="numeric"
            value={leadTime}
            disabled={loading}
            onChange={(event) => {
              invalidatePrediction();
              setLeadTime(event.target.value);
            }}
            className={inputClassName}
          />
        </div>

        <Button
          type="submit"
          disabled={
            loading ||
            !selectedItem ||
            !validLeadTime
          }
          className={[
            "h-11 w-full rounded-xl",
            "bg-[#536D50] px-4",
            "font-semibold text-white",
            "hover:bg-[#435A40]",
            "disabled:opacity-50",
            "sm:w-auto",
          ].join(" ")}
        >
          {loading ? (
            <>
              <Loader2
                aria-hidden="true"
                className="mr-2 size-4 animate-spin"
              />
              Predicting...
            </>
          ) : (
            <>
              <Sparkles
                aria-hidden="true"
                className="mr-2 size-4"
              />
              Predict Stock
            </>
          )}
        </Button>
      </form>

      {/* No items */}
      {items.length === 0 && (
        <p className="px-5 pb-4 text-xs text-[#7A8775]">
          No active inventory items available.
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div
          role="status"
          className="mx-4 mb-4 flex items-start gap-3 rounded-2xl border border-[#8FA58A]/15 bg-[#8FA58A]/10 p-4 sm:mx-5"
        >
          <Loader2
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 animate-spin text-[#536D50]"
          />

          <div className="min-w-0">
            <p className="text-sm font-medium text-[#343B32]">
              Analyzing stock conditions...
            </p>

            <p className="mt-1 text-xs leading-relaxed text-[#7A8775]">
              Processing inventory data and running
              the prediction model.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="mx-4 mb-4 flex items-start gap-2 rounded-2xl border border-[#C9857C]/25 bg-[#C9857C]/10 p-3 sm:mx-5"
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

      {/* Prediction result */}
      {result && (
        <div
          aria-live="polite"
          className="space-y-4 border-t border-[#8FA58A]/15 px-4 py-5 sm:px-5"
        >
          {/* Result heading */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7A8775]">
                Prediction result
              </p>

              <h3 className="mt-1 break-words text-base font-semibold text-[#343B32]">
                {result.item.name}
              </h3>
            </div>

            {currentStatus && (
              <span
                className={[
                  "inline-flex items-center gap-1.5",
                  "rounded-full border px-3 py-1.5",
                  "text-xs font-semibold",
                  currentStatus.className,
                ].join(" ")}
              >
                <StatusIcon
                  aria-hidden="true"
                  className="size-3.5"
                />

                {currentStatus.label}
              </span>
            )}
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <MetricCard
              label="Current"
              value={numberFormatter.format(
                result.features.current_stock
              )}
              unit={result.item.unit}
            />

            <MetricCard
              label="Minimum"
              value={numberFormatter.format(
                result.features.minimum_stock
              )}
              unit={result.item.unit}
            />

            <MetricCard
              label="Confidence"
              value={percentFormatter.format(
                clampProbability(
                  result.prediction.confidence
                )
              )}
              unit="ML model"
            />
          </div>

          {/* Safety override */}
          {result.prediction.safety_override && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#D4AC72]/30 bg-[#D4AC72]/10 p-3"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#A77D3D]"
              />

              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#A77D3D]">
                  Safety rule applied
                </p>

                <p className="mt-1 text-xs leading-relaxed text-[#A77D3D]">
                  Current stock is at or below the
                  minimum threshold. The final
                  status is Restock.
                </p>
              </div>
            </div>
          )}

          {/* Data quality warning */}
          {!qualityIsAdequate && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-[#D4AC72]/20 bg-[#D4AC72]/10 p-3"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#A77D3D]"
              />

              <p className="text-xs leading-relaxed text-[#A77D3D]">
                Historical data quality:{" "}
                <strong>
                  {result.data_quality.level}
                </strong>
                . Review this prediction carefully
                before making stock decisions.
              </p>
            </div>
          )}

          {/* Expandable model details */}
          <div className="overflow-hidden rounded-2xl border border-[#8FA58A]/15 bg-white/55">
            <button
              type="button"
              aria-expanded={detailsOpen}
              aria-controls="ai-prediction-details"
              onClick={() =>
                setDetailsOpen((previous) => !previous)
              }
              className={[
                "flex w-full items-center",
                "justify-between gap-3",
                "px-4 py-3.5 text-left",
                "transition-colors",
                "hover:bg-[#8FA58A]/5",
                "focus-visible:outline-2",
                "focus-visible:outline-offset-[-2px]",
                "focus-visible:outline-[#8FA58A]",
              ].join(" ")}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#343B32]">
                  Model details
                </p>

                <p className="mt-0.5 text-[11px] text-[#7A8775]">
                  Probabilities and data quality
                </p>
              </div>

              <ChevronDown
                aria-hidden="true"
                className={[
                  "size-4 shrink-0",
                  "text-[#7A8775]",
                  "transition-transform duration-200",
                  detailsOpen ? "rotate-180" : "",
                ].join(" ")}
              />
            </button>

            {detailsOpen && (
              <div
                id="ai-prediction-details"
                className="space-y-5 border-t border-[#8FA58A]/15 px-4 py-4"
              >
                {/* Model probabilities */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-[#536D50]">
                    Model probabilities
                  </h4>

                  {STOCK_STATUSES.map((status) => {
                    const probability =
                      clampProbability(
                        result.prediction
                          .probabilities[status] ?? 0
                      );

                    return (
                      <div
                        key={status}
                        className="space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-[#343B32]">
                            {status}
                          </span>

                          <span className="text-xs tabular-nums text-[#7A8775]">
                            {percentFormatter.format(
                              probability
                            )}
                          </span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-[#8FA58A]/12">
                          <div
                            className={[
                              "h-full rounded-full",
                              "transition-[width]",
                              "duration-300",
                              statusConfig[status]
                                .barClassName,
                            ].join(" ")}
                            style={{
                              width: `${
                                probability * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}

                  <p className="text-[11px] leading-relaxed text-[#7A8775]">
                    These probabilities are model
                    outputs, not calibrated
                    reliability estimates.
                  </p>
                </div>

                {/* Data quality */}
                <div className="space-y-3 border-t border-[#8FA58A]/12 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-[#536D50]">
                      Data quality
                    </h4>

                    <span
                      className={[
                        "rounded-full border",
                        "px-2.5 py-1",
                        "text-[11px] font-semibold",
                        qualityIsAdequate
                          ? "border-[#8FA58A]/30 bg-[#8FA58A]/10 text-[#536D50]"
                          : "border-[#D4AC72]/30 bg-[#D4AC72]/10 text-[#A77D3D]",
                      ].join(" ")}
                    >
                      {result.data_quality.level}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-[#F8F6EF]/80 p-3">
                      <p className="text-[11px] text-[#7A8775]">
                        Usage transactions
                      </p>

                      <p className="mt-1 text-sm font-semibold tabular-nums text-[#343B32]">
                        {
                          result.data_quality
                            .usage_transactions
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F8F6EF]/80 p-3">
                      <p className="text-[11px] text-[#7A8775]">
                        Distinct usage days
                      </p>

                      <p className="mt-1 text-sm font-semibold tabular-nums text-[#343B32]">
                        {
                          result.data_quality
                            .distinct_usage_days
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F8F6EF]/80 p-3">
                      <p className="text-[11px] text-[#7A8775]">
                        Waste transactions
                      </p>

                      <p className="mt-1 text-sm font-semibold tabular-nums text-[#343B32]">
                        {
                          result.data_quality
                            .waste_transactions
                        }
                      </p>
                    </div>

                    <div className="rounded-xl bg-[#F8F6EF]/80 p-3">
                      <p className="text-[11px] text-[#7A8775]">
                        History window
                      </p>

                      <p className="mt-1 text-sm font-semibold tabular-nums text-[#343B32]">
                        {
                          result.data_quality
                            .window_days
                        }{" "}
                        days
                      </p>
                    </div>
                  </div>

                  {result.data_quality
                    .limited_history_warning && (
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-[#A77D3D]">
                      <AlertTriangle
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0"
                      />

                      {
                        result.data_quality
                          .limited_history_warning
                      }
                    </p>
                  )}

                  {qualityIsAdequate && (
                    <p className="flex items-start gap-2 text-xs leading-relaxed text-[#536D50]">
                      <CheckCircle2
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />

                      Usage history meets the
                      initial coverage thresholds.
                    </p>
                  )}
                </div>

                {/* Additional features */}
                <div className="space-y-3 border-t border-[#8FA58A]/12 pt-4">
                  <h4 className="text-xs font-semibold text-[#536D50]">
                    Prediction inputs
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#7A8775]">
                        Average daily usage
                      </span>

                      <span className="text-right font-medium tabular-nums text-[#343B32]">
                        {numberFormatter.format(
                          result.features
                            .average_daily_usage
                        )}{" "}
                        {result.item.unit}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-[#7A8775]">
                        Average daily waste
                      </span>

                      <span className="text-right font-medium tabular-nums text-[#343B32]">
                        {numberFormatter.format(
                          result.features
                            .average_daily_waste
                        )}{" "}
                        {result.item.unit}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-[#7A8775]">
                        Lead time
                      </span>

                      <span className="font-medium text-[#343B32]">
                        {
                          result.features
                            .lead_time_days
                        }{" "}
                        days
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-[#7A8775]">
                        Model prediction
                      </span>

                      <span className="font-medium text-[#343B32]">
                        {
                          result.prediction
                            .model_stock_status
                        }
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-[#7A8775]">
                        Model type
                      </span>

                      <span className="break-all text-right font-medium text-[#343B32]">
                        {
                          result.prediction
                            .model_type
                        }
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span className="text-[#7A8775]">
                        Dataset type
                      </span>

                      <span className="break-all text-right font-medium text-[#343B32]">
                        {
                          result.prediction
                            .dataset_type
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#7A8775]">
            <span className="inline-flex items-center gap-1.5">
              <Clock3
                aria-hidden="true"
                className="size-3.5"
              />

              {formatDate(result.calculated_at)}
            </span>

            <span>
              Lead time:{" "}
              {result.features.lead_time_days} days
            </span>
          </div>

          <p className="text-[11px] leading-relaxed text-[#7A8775]">
            Predictions use an ML model trained on
            synthetic rule-labeled data. Model
            probabilities are not calibrated
            reliability estimates. Always verify
            inventory decisions manually.
          </p>
        </div>
      )}
    </section>
  );
}
