
import {
  ArrowDownRight,
  Leaf,
  PackageCheck,
} from "lucide-react";

import type { ItemActivity } from "@/lib/inventory-analytics";

type Props = {
  topUsedMaterials?: ItemActivity[];
  wasteMonitoring?: ItemActivity[];
  period: 7 | 30;
};

type InsightVariant = "usage" | "waste";

type InsightListProps = {
  title: string;
  description: string;
  items?: ItemActivity[];
  empty: string;
  variant: InsightVariant;
};

const formatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const variants = {
  usage: {
    icon: PackageCheck,
    iconBackground: "bg-[#8FA58A]/15",
    iconColor: "text-[#536D50]",
    barColor: "bg-[#8FA58A]",
    trackColor: "bg-[#8FA58A]/12",
  },
  waste: {
    icon: Leaf,
    iconBackground: "bg-[#D4AC72]/15",
    iconColor: "text-[#A77D3D]",
    barColor: "bg-[#D4AC72]",
    trackColor: "bg-[#D4AC72]/15",
  },
} as const;

function InsightList({
  title,
  description,
  items = [],
  empty,
  variant,
}: InsightListProps) {
  const safeItems = Array.isArray(items)
    ? items.slice(0, 5)
    : [];

  const style = variants[variant];
  const Icon = style.icon;

  // Compare quantities only within the same unit.
  const maxByUnit = new Map<string, number>();

  for (const item of safeItems) {
    const quantity = Math.max(
      0,
      Number(item.quantity) || 0
    );

    maxByUnit.set(
      item.unit,
      Math.max(
        maxByUnit.get(item.unit) ?? 0,
        quantity
      )
    );
  }

  return (
    <section
      className={[
        "flex min-w-0 flex-col overflow-hidden",
        "rounded-[26px]",
        "border border-white/55",
        "bg-white/45",
        "backdrop-blur-xl",
        "shadow-[0_10px_36px_rgba(52,59,50,0.045)]",
      ].join(" ")}
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-5 sm:px-5 lg:px-6">
        <span
          className={[
            "flex size-10 shrink-0",
            "items-center justify-center rounded-2xl",
            style.iconBackground,
            style.iconColor,
          ].join(" ")}
        >
          <Icon
            aria-hidden="true"
            className="size-5"
          />
        </span>

        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-[#343B32]">
            {title}
          </h3>

          <p className="mt-1 text-xs leading-relaxed text-[#7A8775]">
            {description}
          </p>
        </div>
      </div>

      {/* Ranked items */}
      <div className="flex-1 px-4 pt-4 pb-5 sm:px-5 lg:px-6">
        {safeItems.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-[#8FA58A]/25 bg-[#F8F6EF]/40 px-4 text-center">
            <span
              className={[
                "flex size-11 items-center justify-center",
                "rounded-2xl",
                style.iconBackground,
                style.iconColor,
              ].join(" ")}
            >
              <Icon
                aria-hidden="true"
                className="size-5"
              />
            </span>

            <p className="max-w-[230px] text-sm leading-relaxed text-[#7A8775]">
              {empty}
            </p>
          </div>
        ) : (
          <ol className="space-y-2.5">
            {safeItems.map((item, index) => {
              const quantity = Math.max(
                0,
                Number(item.quantity) || 0
              );

              const unitMax =
                maxByUnit.get(item.unit) ?? 0;

              const percentage =
                unitMax > 0
                  ? (quantity / unitMax) * 100
                  : 0;

              return (
                <li
                  key={item.item_id}
                  className={[
                    "min-w-0 rounded-[18px]",
                    "border border-white/60",
                    "bg-white/45",
                    "px-3.5 py-3",
                    "transition-colors",
                    "hover:bg-white/70",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={[
                          "flex size-7 shrink-0",
                          "items-center justify-center",
                          "rounded-lg bg-[#8FA58A]/10",
                          "text-[11px] font-semibold",
                          "tabular-nums text-[#536D50]",
                        ].join(" ")}
                      >
                        {index + 1}
                      </span>

                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium text-[#343B32]"
                          title={item.name}
                        >
                          {item.name}
                        </p>

                        <p className="mt-0.5 text-[11px] text-[#7A8775]">
                          {formatter.format(
                            item.transactionCount
                          )} transactions
                        </p>
                      </div>
                    </div>

                    <span className="max-w-[45%] shrink-0 break-words text-right text-sm font-semibold tabular-nums text-[#343B32]">
                      {formatter.format(quantity)}{" "}
                      <span className="text-xs font-medium text-[#7A8775]">
                        {item.unit}
                      </span>
                    </span>
                  </div>

                  {/* Relative activity bar */}
                  <div
                    className={[
                      "mt-3 h-1.5 overflow-hidden",
                      "rounded-full",
                      style.trackColor,
                    ].join(" ")}
                    role="meter"
                    aria-label={`${item.name} relative quantity among items using ${item.unit}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(
                      percentage
                    )}
                  >
                    <div
                      className={[
                        "h-full rounded-full",
                        "transition-[width] duration-300",
                        "motion-reduce:transition-none",
                        style.barColor,
                      ].join(" ")}
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

export default function InventoryInsights({
  topUsedMaterials = [],
  wasteMonitoring = [],
  period,
}: Props) {
  return (
    <section
      aria-labelledby="insights-heading"
      className="min-w-0 space-y-4"
    >
      {/* Section heading */}
      <div>
        <h2
          id="insights-heading"
          className="text-lg font-semibold tracking-tight text-[#343B32]"
        >
          Inventory insights
        </h2>

        <p className="mt-1 text-sm text-[#7A8775]">
          Material movement over the last {period} days.
        </p>
      </div>

      {/* Insights grid */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <InsightList
          title="Top used materials"
          description="Materials with the highest recorded usage"
          items={topUsedMaterials}
          empty="No material usage recorded in this period."
          variant="usage"
        />

        <InsightList
          title="Waste monitoring"
          description="Materials with recorded waste"
          items={wasteMonitoring}
          empty="No waste recorded in this period."
          variant="waste"
        />
      </div>
    </section>
  );
}
