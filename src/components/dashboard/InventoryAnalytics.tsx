
"use client";

import { useMemo } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

type TransactionType =
  | "stock_in"
  | "stock_out"
  | "usage"
  | "waste";

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
};

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const chartColors = {
  stock_in: "#16a34a",
  stock_out: "#2563eb",
  usage: "#f59e0b",
  waste: "#ef4444",
};

// Format quantities using Indonesian notation.
function formatNumber(value: number) {
  return numberFormatter.format(value);
}

// Format dates without timezone shifts.
function formatChartDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  const date = new Date(
    Date.UTC(year, month - 1, day, 12)
  );

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export default function InventoryAnalytics({ data }: Props) {
  // Prepare transaction summary cards.
  const stats = [
    {
      key: "stock_in",
      label: "Stock In",
      value: data.totals.stock_in,
      icon: ArrowDownToLine,
      color: "text-green-600",
      background: "bg-green-500/10",
    },
    {
      key: "stock_out",
      label: "Stock Out",
      value: data.totals.stock_out,
      icon: ArrowUpFromLine,
      color: "text-blue-600",
      background: "bg-blue-500/10",
    },
    {
      key: "usage",
      label: "Usage",
      value: data.totals.usage,
      icon: Package,
      color: "text-amber-600",
      background: "bg-amber-500/10",
    },
    {
      key: "waste",
      label: "Waste",
      value: data.totals.waste,
      icon: Trash2,
      color: "text-red-600",
      background: "bg-red-500/10",
    },
  ] as const;

  // Prepare chart data.
  const chartData = useMemo(
    () =>
      data.daily.map((entry) => ({
        ...entry,
        label: formatChartDate(entry.date),
      })),
    [data.daily]
  );

  // Calculate total transaction count.
  const totalTransactions = Object.values(data.totals).reduce(
    (sum, value) => sum + value,
    0
  );

  // Sort items by stock shortage.
  const lowStockItems = useMemo(
    () =>
      [...data.lowStock].sort((a, b) => {
        const shortageA =
          a.current_stock - a.minimum_stock;

        const shortageB =
          b.current_stock - b.minimum_stock;

        return shortageA - shortageB;
      }),
    [data.lowStock]
  );

  return (
    <div className="space-y-6">
      {/* Analytics summary */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Inventory Overview
          </h2>

          <p className="text-sm text-muted-foreground">
            Monitor inventory activities and stock levels.
          </p>
        </div>

        <Badge variant="secondary" className="w-fit">
          Last 7 Days
        </Badge>
      </div>

      {/* Transaction statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.key}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </p>

                  <div
                    className={`rounded-lg p-2.5 ${stat.background}`}
                  >
                    <Icon
                      className={`h-5 w-5 ${stat.color}`}
                    />
                  </div>
                </div>

                <p className="mt-4 text-3xl font-bold tracking-tight">
                  {formatNumber(stat.value)}
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Transactions in last 7 days
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Stock activity chart */}
      <Card>
        <CardHeader className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Stock Activity</CardTitle>

              <p className="mt-1 text-sm text-muted-foreground">
                Daily stock transaction activity.
              </p>
            </div>

            <Badge variant="outline" className="w-fit">
              {formatNumber(totalTransactions)} Transactions
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-center">
              <p className="text-sm text-muted-foreground">
                No transaction data available.
              </p>
            </div>
          ) : (
            <div className="h-[300px] w-full sm:h-[360px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={chartData}
                  margin={{
                    top: 10,
                    right: 5,
                    left: -20,
                    bottom: 5,
                  }}
                  barGap={2}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                  />

                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "currentColor",
                    }}
                    tickMargin={10}
                  />

                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "currentColor",
                    }}
                  />

                  <Tooltip
                    formatter={(value, name) => [
                      `${formatNumber(Number(value ?? 0))} transactions`,
                      String(name),
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      color: "#111827",
                      backgroundColor: "#ffffff",
                    }}
                  />

                  <Legend
                    wrapperStyle={{
                      fontSize: 12,
                      paddingTop: 12,
                    }}
                  />

                  <Bar
                    dataKey="stock_in"
                    name="Stock In"
                    fill={chartColors.stock_in}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />

                  <Bar
                    dataKey="stock_out"
                    name="Stock Out"
                    fill={chartColors.stock_out}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />

                  <Bar
                    dataKey="usage"
                    name="Usage"
                    fill={chartColors.usage}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />

                  <Bar
                    dataKey="waste"
                    name="Waste"
                    fill={chartColors.waste}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low stock alerts */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Low Stock Alerts
            </CardTitle>

            <Badge
              variant={
                data.lowStockCount > 0
                  ? "destructive"
                  : "secondary"
              }
            >
              {data.lowStockCount} Items
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Items at or below their minimum stock level.
          </p>
        </CardHeader>

        <CardContent>
          {lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>

              <p className="font-medium">
                All Stock Levels Are Healthy
              </p>

              <p className="text-sm text-muted-foreground">
                No inventory items require restocking.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((item) => {
                const isOutOfStock =
                  item.current_stock <= 0;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={
                          isOutOfStock
                            ? "rounded-lg bg-red-500/10 p-2"
                            : "rounded-lg bg-amber-500/10 p-2"
                        }
                      >
                        <Package
                          className={
                            isOutOfStock
                              ? "h-5 w-5 text-red-600"
                              : "h-5 w-5 text-amber-600"
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <p className="font-medium">
                          {item.name}
                        </p>

                        <Badge
                          variant={
                            isOutOfStock
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {isOutOfStock
                            ? "Out of Stock"
                            : "Low Stock"}
                        </Badge>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="font-semibold">
                        {formatNumber(item.current_stock)}{" "}
                        {item.unit}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Minimum:{" "}
                        {formatNumber(item.minimum_stock)}{" "}
                        {item.unit}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
