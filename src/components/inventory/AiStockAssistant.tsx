
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
  Clock3,
  Loader2,
  Package,
  Sparkles,
} from "lucide-react";

import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";

import {
  INVENTORY_UPDATED_EVENT,
} from "@/lib/inventory-events";

type InventoryOption = {
  id: string;
  name: string;
  unit: string;
};

type StockStatus =
  | "Restock"
  | "Sufficient"
  | "Excess";

type RagResult = {
  item: {
    id: string;
    name: string;
    unit?: string;
  };
  inventory: {
    current_stock: number;
    minimum_stock: number;
  };
  prediction: {
    stock_status: StockStatus;
    confidence: number;
  };
  data_quality: string;
  lead_time_days: number;
  summary: string;
  generated_at: string;
};

type RagResponse = {
  success?: boolean;
  message?: string;
  data?: RagResult;
};

type Props = {
  items: InventoryOption[];
};

const numberFormatter = new Intl.NumberFormat(
  "id-ID",
  {
    maximumFractionDigits: 2,
  }
);

const percentFormatter = new Intl.NumberFormat(
  "id-ID",
  {
    style: "percent",
    maximumFractionDigits: 1,
  }
);

const inputClassName = [
  "h-11 w-full min-w-0 rounded-xl",
  "border border-[#8FA58A]/20",
  "bg-white/70 px-3",
  "text-sm text-[#343B32]",
  "outline-none",
  "transition-colors",
  "focus-visible:border-[#8FA58A]",
  "focus-visible:ring-2",
  "focus-visible:ring-[#8FA58A]/20",
  "disabled:cursor-not-allowed",
  "disabled:opacity-50",
].join(" ");

const labelClassName =
  "text-xs font-semibold text-[#536D50]";

const statusConfig: Record<
  StockStatus,
  {
    label: string;
    icon: typeof AlertTriangle;
    className: string;
  }
> = {
  Restock: {
    label: "Restock",
    icon: AlertTriangle,
    className:
      "border-[#D4AC72]/30 bg-[#D4AC72]/15 text-[#A77D3D]",
  },
  Sufficient: {
    label: "Sufficient",
    icon: CheckCircle2,
    className:
      "border-[#8FA58A]/30 bg-[#8FA58A]/15 text-[#536D50]",
  },
  Excess: {
    label: "Excess",
    icon: Package,
    className:
      "border-[#8A9EB6]/30 bg-[#8A9EB6]/15 text-[#607D9C]",
  },
};

function formatGeneratedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AiStockAssistant({
  items,
}: Props) {
  const [itemId, setItemId] = useState("");
  const [leadTime, setLeadTime] = useState("3");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [result, setResult] =
    useState<RagResult | null>(null);

  const controllerRef =
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

  // Cancel pending requests when unmounted.
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      submittingRef.current = false;
    };
  }, []);

  function invalidateResult() {
    requestIdRef.current += 1;

    controllerRef.current?.abort();
    controllerRef.current = null;

    submittingRef.current = false;

    setLoading(false);
    setError("");
    setResult(null);
  }

  // Clear outdated recommendations when stock changes.
  useEffect(() => {
    function handleInventoryUpdated() {
      invalidateResult();
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

  async function handleGenerate(
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

    invalidateResult();

    const requestId = requestIdRef.current;

    const controller = new AbortController();

    controllerRef.current = controller;
    submittingRef.current = true;

    setLoading(true);

    try {
      const response = await fetch(
        "/api/v1/ai/rag",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            item_id: selectedItem.id,
            lead_time_days: leadTimeNumber,
          }),
          cache: "no-store",
          signal: controller.signal,
        }
      );

      const payload: RagResponse | null =
        await response.json().catch(() => null);

      if (
        !response.ok ||
        payload?.success !== true ||
        !payload.data
      ) {
        throw new Error(
          payload?.message ??
            "Gagal menghasilkan rekomendasi AI."
        );
      }

      if (
        typeof payload.data.summary !== "string" ||
        !payload.data.summary.trim()
      ) {
        throw new Error(
          "Respons AI tidak memiliki rekomendasi."
        );
      }

      if (requestId !== requestIdRef.current) {
        return;
      }

      setResult(payload.data);
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
          : "Terjadi kesalahan saat menghubungi AI."
      );
    } finally {
      if (requestId === requestIdRef.current) {
        submittingRef.current = false;
        setLoading(false);
        controllerRef.current = null;
      }
    }
  }

  const currentStatus = result
    ? statusConfig[
        result.prediction.stock_status
      ]
    : null;

  const StatusIcon =
    currentStatus?.icon ?? Package;

  const resultUnit = result
    ? result.item.unit ??
      items.find(
        (item) => item.id === result.item.id
      )?.unit ??
      ""
    : "";

  return (
    <section
      aria-labelledby="ai-assistant-title"
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
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-4 pt-5 sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-[#8FA58A]/15 text-[#536D50]">
            <BrainCircuit
              aria-hidden="true"
              className="size-5"
            />
          </span>

          <div className="min-w-0">
            <h2
              id="ai-assistant-title"
              className="text-base font-semibold tracking-tight text-[#343B32]"
            >
              AI Stock Assistant
            </h2>

            <p className="mt-1 text-xs leading-relaxed text-[#7A8775]">
              Smart inventory recommendations
              powered by ML and RAG.
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <form
        onSubmit={handleGenerate}
        className="grid gap-3 border-t border-[#8FA58A]/10 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end sm:px-5"
      >
        <div className="min-w-0 space-y-2">
          <label
            htmlFor="rag-item"
            className={labelClassName}
          >
            Inventory item
          </label>

          <select
            id="rag-item"
            value={itemId}
            disabled={
              loading || items.length === 0
            }
            onChange={(event) => {
              invalidateResult();
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
            htmlFor="rag-lead-time"
            className={labelClassName}
          >
            Lead time (days)
          </label>

          <input
            id="rag-lead-time"
            type="number"
            min={1}
            max={365}
            step={1}
            inputMode="numeric"
            value={leadTime}
            disabled={loading}
            onChange={(event) => {
              invalidateResult();
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
              Generating...
            </>
          ) : (
            <>
              <Sparkles
                aria-hidden="true"
                className="mr-2 size-4"
              />
              Generate
            </>
          )}
        </Button>
      </form>

      {/* Empty inventory */}
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
              Preparing your recommendation...
            </p>

            <p className="mt-1 text-xs leading-relaxed text-[#7A8775]">
              Analyzing stock patterns and retrieving
              relevant inventory knowledge.
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

      {/* Results */}
      {result && (
        <div
          aria-live="polite"
          className="space-y-4 border-t border-[#8FA58A]/15 px-4 py-5 sm:px-5"
        >
          {/* Result heading */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#7A8775]">
                Recommendation for
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

          {/* Compact stock summary */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="min-w-0 rounded-2xl bg-[#F8F6EF]/75 p-3">
              <p className="text-[11px] text-[#7A8775]">
                Current
              </p>

              <p className="mt-1 break-words text-sm font-semibold tabular-nums text-[#343B32] sm:text-base">
                {numberFormatter.format(
                  result.inventory.current_stock
                )}
              </p>

              <p className="mt-0.5 text-[10px] text-[#7A8775]">
                {resultUnit}
              </p>
            </div>

            <div className="min-w-0 rounded-2xl bg-[#F8F6EF]/75 p-3">
              <p className="text-[11px] text-[#7A8775]">
                Minimum
              </p>

              <p className="mt-1 break-words text-sm font-semibold tabular-nums text-[#343B32] sm:text-base">
                {numberFormatter.format(
                  result.inventory.minimum_stock
                )}
              </p>

              <p className="mt-0.5 text-[10px] text-[#7A8775]">
                {resultUnit}
              </p>
            </div>

            <div className="min-w-0 rounded-2xl bg-[#F8F6EF]/75 p-3">
              <p className="text-[11px] text-[#7A8775]">
                Confidence
              </p>

              <p className="mt-1 break-words text-sm font-semibold tabular-nums text-[#343B32] sm:text-base">
                {percentFormatter.format(
                  result.prediction.confidence
                )}
              </p>

              <p className="mt-0.5 text-[10px] text-[#7A8775]">
                ML model
              </p>
            </div>
          </div>

          {/* Data quality warning */}
          {result.data_quality !== "adequate" && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-[#D4AC72]/25 bg-[#D4AC72]/10 p-3"
            >
              <AlertTriangle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-[#A77D3D]"
              />

              <p className="text-xs leading-relaxed text-[#A77D3D]">
                Limited historical data (
                {result.data_quality}). Review this
                recommendation before taking action.
              </p>
            </div>
          )}

          {/* AI recommendation */}
          <div className="min-w-0 rounded-2xl border border-[#8FA58A]/15 bg-white/60 p-4 sm:p-5">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles
                aria-hidden="true"
                className="size-4 text-[#536D50]"
              />

              <h4 className="text-sm font-semibold text-[#343B32]">
                AI Recommendation
              </h4>
            </div>

            <div
              className={[
                "min-w-0 break-words",
                "text-sm leading-7 text-[#343B32]",
                "[&_p]:my-2",
                "[&_strong]:font-semibold",
                "[&_h1]:font-semibold",
                "[&_h2]:font-semibold",
                "[&_h3]:font-semibold",
                "[&_ul]:my-2",
                "[&_ul]:list-disc",
                "[&_ul]:space-y-1",
                "[&_ul]:pl-5",
                "[&_ol]:my-2",
                "[&_ol]:list-decimal",
                "[&_ol]:space-y-1",
                "[&_ol]:pl-5",
                "[&_li]:pl-0.5",
              ].join(" ")}
            >
              <ReactMarkdown
                skipHtml
                components={{
                  a: ({ children }) => (
                    <span>{children}</span>
                  ),
                }}
              >
                {result.summary}
              </ReactMarkdown>
            </div>
          </div>

          {/* Compact footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-relaxed text-[#7A8775]">
            <span className="inline-flex items-center gap-1.5">
              <Clock3
                aria-hidden="true"
                className="size-3.5"
              />

              {formatGeneratedAt(
                result.generated_at
              )}
            </span>

            <span>
              Lead time: {result.lead_time_days} days
            </span>
          </div>

          <p className="text-[11px] leading-relaxed text-[#7A8775]">
            Generated with RAG and an ML model trained
            on synthetic rule-labeled data.
            Predictions are estimates, not guarantees.
            Verify inventory decisions manually.
          </p>
        </div>
      )}
    </section>
  );
}
