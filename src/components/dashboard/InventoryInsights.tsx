
import type { ItemActivity } from "@/lib/inventory-analytics";

type Props = {
  topUsedMaterials?: ItemActivity[];
  wasteMonitoring?: ItemActivity[];
  period: 7 | 30;
};

const formatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

function InsightList({
  title,
  description,
  items = [],
  empty,
}: {
  title: string;
  description: string;
  items?: ItemActivity[];
  empty: string;
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border bg-card">
      <div className="border-b px-4 py-4 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {description}
            </p>
          </div>

          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {safeItems.length} items
          </span>
        </div>
      </div>

      {safeItems.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground sm:px-5">
          {empty}
        </p>
      ) : (
        <ol className="divide-y px-4 sm:px-5">
          {safeItems.slice(0, 5).map((item, index) => (
            <li
              key={item.item_id}
              className="flex min-w-0 items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-4 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>

                <div className="min-w-0">
                  <p
                    className="truncate text-sm font-medium"
                    title={item.name}
                  >
                    {item.name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {item.transactionCount} transactions
                  </p>
                </div>
              </div>

              <span className="max-w-[45%] shrink-0 text-right text-sm font-medium tabular-nums break-words">
                {formatter.format(item.quantity)} {item.unit}
              </span>
            </li>
          ))}
        </ol>
      )}
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
      <div>
        <h2
          id="insights-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Inventory insights
        </h2>

        <p className="text-sm text-muted-foreground">
          Usage and waste during the last {period} days.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <InsightList
          title="Top used materials"
          description="Ranked by usage frequency"
          items={topUsedMaterials}
          empty="No material usage recorded in this period."
        />

        <InsightList
          title="Waste monitoring"
          description="Items with recorded waste transactions"
          items={wasteMonitoring}
          empty="No waste recorded in this period."
        />
      </div>
    </section>
  );
}
