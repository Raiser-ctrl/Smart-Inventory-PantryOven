
"use client";

import { useId, useMemo, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useContainerWidth } from "@/hooks/useContainerWidth";

type TransactionType =
  | "stock_in"
  | "stock_out"
  | "usage"
  | "waste";

type ActivityFilter = TransactionType | "all";

type DailyActivity = {
  date: string;
  stock_in: number;
  stock_out: number;
  usage: number;
  waste: number;
};

type LowStockItem = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
};

type AnalyticsData = {
  totals: Record<TransactionType, number>;
  daily: DailyActivity[];
  lowStock: LowStockItem[];
  lowStockCount: number;
};

type Props = {
  data: AnalyticsData;
  period?: 7 | 30;
  inventoryAvailable?: boolean;
};

type ChartEntry = DailyActivity & {
  label: string;
  rangeLabel?: string;
};

const formatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const DAY_MS = 86_400_000;

const activityTypes: {
  key: TransactionType;
  label: string;
  color: string;
}[] = [
  {
    key: "stock_in",
    label: "Stock in",
    color: "#4d9270",
  },
  {
    key: "stock_out",
    label: "Stock out",
    color: "#6588b3",
  },
  {
    key: "usage",
    label: "Usage",
    color: "#c69a4b",
  },
  {
    key: "waste",
    label: "Waste",
    color: "#c46c68",
  },
];

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(
    new Date(Date.UTC(year, month - 1, day, 12))
  );
}

function createWeeklyData(
  daily: DailyActivity[]
): ChartEntry[] {
  const sorted = [...daily].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  if (sorted.length === 0) {
    return [];
  }

  const firstDate = new Date(
    `${sorted[0].date}T00:00:00Z`
  );

  const lastDate = new Date(
    `${sorted[sorted.length - 1].date}T00:00:00Z`
  );

  const groups = new Map<
    number,
    {
      start: string;
      end: string;
      totals: Record<TransactionType, number>;
    }
  >();

  for (const entry of sorted) {
    const date = new Date(
      `${entry.date}T00:00:00Z`
    );

    const daysSinceStart = Math.floor(
      (date.getTime() - firstDate.getTime()) / DAY_MS
    );

    const groupIndex = Math.floor(
      daysSinceStart / 7
    );

    const groupStart = new Date(
      firstDate.getTime() + groupIndex * 7 * DAY_MS
    );

    const groupEnd = new Date(
      Math.min(
        groupStart.getTime() + 6 * DAY_MS,
        lastDate.getTime()
      )
    );

    const start = groupStart.toISOString().slice(0, 10);
    const end = groupEnd.toISOString().slice(0, 10);

    if (!groups.has(groupIndex)) {
      groups.set(groupIndex, {
        start,
        end,
        totals: {
          stock_in: 0,
          stock_out: 0,
          usage: 0,
          waste: 0,
        },
      });
    }

    const group = groups.get(groupIndex)!;

    for (const type of activityTypes) {
      group.totals[type.key] += Number(
        entry[type.key] ?? 0
      );
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, group]) => ({
      date: group.start,
      label: `W${index + 1}`,
      rangeLabel: `${formatDate(
        group.start
      )} – ${formatDate(group.end)}`,
      ...group.totals,
    }));
}

function getEntryLabel(entry: ChartEntry) {
  return entry.rangeLabel ?? formatDate(entry.date);
}

function ActivityChart({
  data,
  selected,
  mobile,
  width,
  period,
  onSelectEntry,
}: {
  data: ChartEntry[];
  selected: ActivityFilter;
  mobile: boolean;
  width: number;
  period: 7 | 30;
  onSelectEntry: (entry: ChartEntry) => void;
}) {
  const visibleTypes = activityTypes.filter(
    (type) =>
      selected === "all" || type.key === selected
  );

  const groupedWeekly = period === 30;

  const chartHeight = mobile ? 220 : 290;

  const maxBarSize =
    selected === "all"
      ? groupedWeekly
        ? mobile
          ? 16
          : 26
        : mobile
          ? 12
          : 22
      : groupedWeekly
        ? mobile
          ? 42
          : 64
        : mobile
          ? 32
          : 48;

  return (
    <BarChart
      width={width}
      height={chartHeight}
      data={data}
      accessibilityLayer
      margin={{
        top: 14,
        right: mobile ? 4 : 12,
        left: mobile ? -22 : -12,
        bottom: 4,
      }}
      barCategoryGap={
        groupedWeekly ? "25%" : "30%"
      }
      barGap={3}
    onClick={(state) => {
  const index = state?.activeTooltipIndex;

  if (index === undefined || index === null) {
    return;
  }

  const selectedIndex = Number(index);

  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= data.length
  ) {
    return;
  }

  onSelectEntry(data[selectedIndex]);
}}
    >
      <CartesianGrid
        stroke="currentColor"
        strokeOpacity={0.08}
        vertical={false}
      />

      <XAxis
        dataKey="label"
        axisLine={false}
        tickLine={false}
        tickMargin={10}
        interval={0}
        minTickGap={8}
        tick={{
          fontSize: mobile ? 10 : 11,
          fill: "var(--muted-foreground)",
        }}
      />

      <YAxis
        allowDecimals={false}
        axisLine={false}
        tickLine={false}
        width={36}
        tick={{
          fontSize: mobile ? 10 : 11,
          fill: "var(--muted-foreground)",
        }}
      />

      <Tooltip
        cursor={{
          fill: "var(--muted)",
          fillOpacity: 0.35,
        }}
        labelFormatter={(label, payload) => {
          const entry = payload?.[0]
            ?.payload as ChartEntry | undefined;

          return entry
            ? getEntryLabel(entry)
            : String(label);
        }}
        formatter={(value, name) => [
          `${formatter.format(
            Number(value ?? 0)
          )} transactions`,
          String(name),
        ]}
        wrapperStyle={{
          pointerEvents: "none",
          maxWidth: "min(240px, 80vw)",
          zIndex: 10,
        }}
        contentStyle={{
          border: "1px solid var(--border)",
          borderRadius: 12,
          backgroundColor: "var(--card)",
          color: "var(--foreground)",
          fontSize: 12,
          boxShadow:
            "0 8px 24px rgba(0,0,0,0.08)",
        }}
        labelStyle={{
          color: "var(--foreground)",
          fontWeight: 600,
        }}
      />

      {visibleTypes.map((type) => (
        <Bar
          key={type.key}
          dataKey={type.key}
          name={type.label}
          fill={type.color}
          maxBarSize={maxBarSize}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      ))}
    </BarChart>
  );
}

export default function InventoryAnalytics({
  data,
  period = 7,
}: Props) {
  const [selected, setSelected] =
    useState<ActivityFilter>("all");

  const [selectedEntry, setSelectedEntry] =
    useState<ChartEntry | null>(null);

  const filterId = useId();
  const headingId = useId();

  const {
    ref: chartContainerRef,
    width: chartWidth,
  } = useContainerWidth<HTMLDivElement>();

  const isMobile =
    chartWidth > 0 && chartWidth < 640;

  const chartData = useMemo(
    () =>
      data.daily.map((entry) => ({
        ...entry,
        label: formatDate(entry.date),
      })),
    [data.daily]
  );

  const displayedData = useMemo(
    () =>
      period === 30
        ? createWeeklyData(data.daily)
        : chartData,
    [data.daily, chartData, period]
  );

  const total = activityTypes.reduce(
    (sum, type) =>
      sum + Number(data.totals[type.key] ?? 0),
    0
  );

  const selectedTotal =
    selected === "all"
      ? total
      : Number(data.totals[selected] ?? 0);

  const selectedLabel =
    selected === "all"
      ? "Total transactions"
      : activityTypes.find(
          (type) => type.key === selected
        )?.label ?? "Transactions";

  // Resolve the selected entry against the current
  // dataset so period changes cannot show stale data.
  const activeEntry = selectedEntry
    ? displayedData.find(
        (entry) =>
          entry.date === selectedEntry.date &&
          entry.label === selectedEntry.label
      ) ?? null
    : null;

  const handleSelectEntry = (entry: ChartEntry) => {
    setSelectedEntry((previous) => {
      if (
        previous?.date === entry.date &&
        previous?.label === entry.label
      ) {
        return null;
      }

      return entry;
    });
  };

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 overflow-hidden rounded-xl border bg-card p-3.5 sm:p-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          id={headingId}
          className="text-sm font-semibold sm:text-base"
        >
          Stock activity
        </h3>

        <label
          htmlFor={filterId}
          className="sr-only"
        >
          Filter transaction type
        </label>

        <select
          id={filterId}
          value={selected}
          onChange={(event) => {
            setSelected(
              event.target.value as ActivityFilter
            );
            setSelectedEntry(null);
          }}
          className="min-h-11 max-w-full rounded-md border bg-background px-3 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
        >
          <option value="all">
            All activity
          </option>

          {activityTypes.map((type) => (
            <option
              key={type.key}
              value={type.key}
            >
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Activity total */}
      <div className="mt-3 border-b pb-3">
        <p className="text-xs text-muted-foreground">
          {selectedLabel}
        </p>

        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {formatter.format(selectedTotal)}
        </p>
      </div>

      {/* Responsive chart */}
      <div
        ref={chartContainerRef}
        className="mt-3 min-h-[220px] w-full min-w-0 overflow-hidden [touch-action:pan-y] sm:min-h-[290px]"
      >
        {chartWidth > 0 && displayedData.length > 0 ? (
          <ActivityChart
            data={displayedData}
            period={period}
            selected={selected}
            mobile={isMobile}
            width={chartWidth}
            onSelectEntry={handleSelectEntry}
          />
        ) : (
          <div className="flex h-[220px] items-center justify-center text-center text-sm text-muted-foreground sm:h-[290px]">
            {chartWidth === 0
              ? "Preparing chart..."
              : "No activity data available."}
          </div>
        )}
      </div>

      {displayedData.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {period === 30
            ? "Grouped by week · "
            : ""}
          Tap or hover to view details
        </p>
      )}

      {/* Persistent details for touch devices */}
      {activeEntry && (
        <div
          className="mt-3 rounded-lg border bg-muted/30 p-3"
          aria-live="polite"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                Selected activity
              </p>

              <p className="mt-0.5 text-sm font-semibold">
                {getEntryLabel(activeEntry)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedEntry(null)}
              className="min-h-10 shrink-0 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close selected activity details"
            >
              Close
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {activityTypes
              .filter(
                (type) =>
                  selected === "all" ||
                  selected === type.key
              )
              .map((type) => (
                <div
                  key={type.key}
                  className="min-w-0 rounded-md border bg-card p-2.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: type.color,
                      }}
                    />

                    <p className="truncate text-xs text-muted-foreground">
                      {type.label}
                    </p>
                  </div>

                  <p className="mt-1 text-base font-semibold tabular-nums">
                    {formatter.format(
                      Number(activeEntry[type.key] ?? 0)
                    )}
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {selectedTotal === 0 && total > 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          No {selectedLabel.toLowerCase()} recorded
          in this period.
        </p>
      )}
    </section>
  );
}
