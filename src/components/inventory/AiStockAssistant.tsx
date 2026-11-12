
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
  Loader2,
  Sparkles,
} from "lucide-react";

import ReactMarkdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
      controllerRef.current?.abort();
    };
  }, []);

  function invalidateResult() {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;

    setLoading(false);
    setError("");
    setResult(null);
  }

  async function handleGenerate(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      loading ||
      !selectedItem ||
      !validLeadTime
    ) {
      return;
    }

    invalidateResult();

    const requestId = requestIdRef.current;
    const controller = new AbortController();

    controllerRef.current = controller;
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

      const payload: RagResponse =
        await response.json();

      if (
        !response.ok ||
        payload.success !== true ||
        !payload.data
      ) {
        throw new Error(
          payload.message ??
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
        setLoading(false);
        controllerRef.current = null;
      }
    }
  }

  return (
    <section
      aria-labelledby="ai-assistant-title"
      className="min-w-0 space-y-4 rounded-xl border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BrainCircuit className="size-5" />
          </div>

          <div>
            <h2
              id="ai-assistant-title"
              className="text-base font-semibold tracking-tight sm:text-lg"
            >
              AI Stock Assistant
            </h2>

            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Generate inventory recommendations
              using machine learning and RAG.
            </p>
          </div>
        </div>

        <Badge variant="secondary">
          <Sparkles className="mr-1 size-3" />
          AI Recommendation
        </Badge>
      </div>

      <form
        onSubmit={handleGenerate}
        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-end"
      >
        <div className="min-w-0 space-y-1.5">
          <label
            htmlFor="rag-item"
            className="text-xs font-medium"
          >
            Inventory item
          </label>

          <select
            id="rag-item"
            value={itemId}
            disabled={loading || items.length === 0}
            onChange={(event) => {
              invalidateResult();
              setItemId(event.target.value);
            }}
            className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            <option value="">
              Select an active item
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

        <div className="space-y-1.5">
          <label
            htmlFor="rag-lead-time"
            className="text-xs font-medium"
          >
            Lead time (days)
          </label>

          <input
            id="rag-lead-time"
            type="number"
            min={1}
            max={365}
            step={1}
            value={leadTime}
            disabled={loading}
            onChange={(event) => {
              invalidateResult();
              setLeadTime(event.target.value);
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>

        <Button
          type="submit"
          disabled={
            loading ||
            !selectedItem ||
            !validLeadTime
          }
          className="w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 size-4" />
              Generate
            </>
          )}
        </Button>
      </form>

      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No active inventory items available.
        </p>
      )}

      {loading && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4"
        >
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" />

          <div className="space-y-1">
            <p className="text-sm font-medium">
              Generating AI recommendation...
            </p>

            <p className="text-xs text-muted-foreground">
              Analyzing inventory, predicting
              stock status, and retrieving
              knowledge base references.
            </p>
          </div>
        </div>
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
                Recommendation for
              </p>

              <h3 className="font-semibold">
                {result.item.name}
              </h3>
            </div>

            <Badge
              variant="outline"
              className={
                statusStyles[
                  result.prediction.stock_status
                ] ?? ""
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
                  result.inventory.current_stock
                )}{" "}
                {result.item.unit ??
                  selectedItem?.unit ??
                  ""}
              </p>
            </div>

            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">
                Minimum stock
              </p>

              <p className="mt-1 text-lg font-semibold tabular-nums">
                {numberFormatter.format(
                  result.inventory.minimum_stock
                )}{" "}
                {result.item.unit ??
                  selectedItem?.unit ??
                  ""}
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

          {result.data_quality !== "adequate" && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
            >
              <AlertTriangle className="size-4 shrink-0" />

              <span>
                Data quality: {result.data_quality}.
                Historical usage data is limited.
                Review recommendations manually.
              </span>
            </div>
          )}

          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />

              <h3 className="text-sm font-semibold">
                AI Recommendation
              </h3>
            </div>

            <div className="min-w-0 space-y-3 break-words text-sm leading-relaxed text-foreground [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h3]:text-sm [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
              <ReactMarkdown
                skipHtml
                components={{
                  a: ({ children, ...props }) => (
                    <span>{children}</span>
                  ),
                }}
              >
                {result.summary}
              </ReactMarkdown>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Generated using RAG and an ML model
            trained on synthetic rule-labeled data.
            Predictions are not guarantees.
            Always verify stock decisions manually.
          </p>

          <p className="text-xs text-muted-foreground">
            Generated at:{" "}
            {new Date(
              result.generated_at
            ).toLocaleString("id-ID")}
          </p>
        </div>
      )}
    </section>
  );
}
