
"use client";

import { useId, useState } from "react";

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

type ItemSeries = {
  item_id: string;
  name: string;
  unit: string;
  category: string;
  totals: Record<TransactionType, number>;
  daily: DailyActivity[];
  transactionCount: number;
};

type AnalyticsData = {
  itemSeries?: ItemSeries[];
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
    label: "Stok masuk",
    color: "#607E5A",
  },
  {
    key: "stock_out",
    label: "Stok keluar",
    color: "#647E9B",
  },
  {
    key: "usage",
    label: "Pemakaian",
    color: "#B77653",
  },
  {
    key: "waste",
    label: "Waste",
    color: "#B68B32",
  },
];

function formatDate(value: string): string {
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
    .map(([, group]) => ({
      date: group.start,
      label: `${formatDate(group.start)}`,
      rangeLabel: `${formatDate(
        group.start
      )} – ${formatDate(group.end)}`,
      ...group.totals,
    }));
}

function getEntryLabel(entry: ChartEntry): string {
  return entry.rangeLabel ?? formatDate(entry.date);
}

function ActivityChart({
  data,
  selected,
  mobile,
  width,
  weekly,
  unit,
  quantityMode,
}: {
  data: ChartEntry[];
  selected: ActivityFilter;
  mobile: boolean;
  width: number;
  weekly: boolean;
  unit: string;
  quantityMode: boolean;
}) {
  const visibleTypes = activityTypes.filter(
    (type) =>
      selected === "all" || type.key === selected
  );

  const groupedWeekly = weekly;

  const chartHeight = mobile ? 224 : 292;

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
        left: 0,
        bottom: 4,
      }}
      barCategoryGap={
        groupedWeekly ? "25%" : "30%"
      }
      barGap={3}

    >
      <CartesianGrid
        stroke="#82907D"
        strokeOpacity={0.13}
        vertical={false}
        strokeDasharray="3 5"
      />

      <XAxis
        dataKey="label"
        axisLine={false}
        tickLine={false}
        tickMargin={12}
        interval={data.length > 10 ? "preserveStartEnd" : 0}
        minTickGap={8}
        tick={{
          fontSize: mobile ? 10 : 11,
          fill: "#7A8775",
        }}
      />

      <YAxis
        allowDecimals={quantityMode}
        domain={[0, "auto"]}
        tickFormatter={(value: number) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value)}
        axisLine={false}
        tickLine={false}
        width={48}
        tick={{
          fontSize: mobile ? 10 : 11,
          fill: "#7A8775",
        }}
      />

      <Tooltip
        cursor={{
          fill: "#8FA58A",
          fillOpacity: 0.09,
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
          )} ${unit}`,
          String(name),
        ]}
        wrapperStyle={{
          pointerEvents: "none",
          maxWidth: "min(240px, 80vw)",
          zIndex: 10,
        }}
        contentStyle={{
          border: "1px solid rgba(255,255,255,0.65)",
          borderRadius: 16,
          backgroundColor: "rgba(250,247,240,0.96)",
          color: "#343B32",
          fontSize: 12,
          boxShadow:
            "0 12px 32px rgba(52,59,50,0.12)",
          backdropFilter: "blur(16px)",
        }}
        labelStyle={{
          color: "#343B32",
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
          radius={[6, 6, 0, 0]}
          isAnimationActive={false}
        />
      ))}
    </BarChart>
  );
}

export default function InventoryAnalytics({ data, period = 7 }: Props) {
  const [itemId, setItemId] = useState("all");
  const headingId = useId();
  const itemSelectId = useId();
  const { ref: chartContainerRef, width: chartWidth } = useContainerWidth<HTMLDivElement>();
  const isMobile = chartWidth > 0 && chartWidth < 640;
  const item = data.itemSeries?.find(entry => entry.item_id === itemId);
  const unit = item?.unit ?? "transaksi";
  const daily = item?.daily ?? data.daily;
  // Longer periods use fewer groups so the chart fits without horizontal scrolling.
  const weekly = period === 30;
  const displayedData: ChartEntry[] = weekly
    ? createWeeklyData(daily)
    : [...daily]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(entry => ({ ...entry, label: formatDate(entry.date) }));
  const hasActivity = displayedData.some(entry =>
    activityTypes.some(type => entry[type.key] > 0)
  );

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 rounded-[24px] border border-white/60 bg-white/55 p-4 shadow-[0_8px_28px_rgba(52,59,50,0.035)] sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id={headingId} className="text-base font-semibold tracking-tight text-[#343b32]">
            Stock Activity
          </h3>
          <p className="mt-1 text-xs text-[#677260]">
            {period} hari terakhir · {weekly ? "Per 7 hari" : "Harian"}
          </p>
        </div>
        <div className="w-full min-w-0 sm:w-44">
          <label htmlFor={itemSelectId} className="sr-only">Pilih bahan atau produk</label>
          <select
            id={itemSelectId}
            value={item?.item_id ?? "all"}
            onChange={event => setItemId(event.target.value)}
            className="min-h-10 w-full rounded-xl border border-[#8fa58a]/20 bg-white/70 px-3 text-xs text-[#536d50] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#536d50]"
          >
            <option value="all">Semua item</option>
            {(data.itemSeries ?? []).map(entry => (
              <option key={entry.item_id} value={entry.item_id}>{entry.name} ({entry.unit})</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2" aria-label="Legenda chart">
        {activityTypes.map(type => (
          <span key={type.key} className="inline-flex items-center gap-1.5 text-[11px] text-[#5d6857]">
            <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: type.color }} />
            {type.label}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[11px] text-[#677260]">
        {item ? `Kuantitas (${unit})` : "Jumlah transaksi"}
      </p>
      <div ref={chartContainerRef} className="mt-1 min-h-[224px] w-full min-w-0 sm:min-h-[292px]">
        {chartWidth > 0 && hasActivity ? (
          <ActivityChart
            data={displayedData}
            weekly={weekly}
            unit={unit}
            quantityMode={Boolean(item)}
            selected="all"
            mobile={isMobile}
            width={chartWidth}
          />
        ) : (
          <div role="status" className="flex h-[224px] items-center justify-center px-4 text-center text-sm text-[#677260] sm:h-[292px]">
            {chartWidth === 0 ? "Menyiapkan chart..." : "Belum ada aktivitas dalam periode ini."}
          </div>
        )}
      </div>
      {hasActivity && (
        <p className="mt-2 text-center text-[11px] text-[#677260]">
          Arahkan kursor atau ketuk batang untuk detail.
        </p>
      )}
    </section>
  );
}
