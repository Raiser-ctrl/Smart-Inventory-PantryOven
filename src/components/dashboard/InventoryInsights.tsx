
import {
  PackageCheck,
  Trash2,
  BarChart3,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import type { ItemActivity } from "@/lib/inventory-analytics";

type Props = {
  topUsedMaterials: ItemActivity[];
  wasteMonitoring: ItemActivity[];
  period: 7 | 30;
};

const numberFormatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export default function InventoryInsights({
  topUsedMaterials,
  wasteMonitoring,
  period,
}: Props) {
  // Show up to five items in each report.
  const topMaterials = topUsedMaterials.slice(0, 5);
  const topWaste = wasteMonitoring.slice(0, 5);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          Inventory Insights
        </h2>

        <p className="mt-1 text-sm text-muted-foreground">
          Usage and waste monitoring for the last {period} days.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top used materials */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <PackageCheck className="h-5 w-5 text-amber-600" />
                Top Used Materials
              </CardTitle>

              <Badge variant="secondary">
                {topUsedMaterials.length} Items
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Ranked by usage transaction frequency.
            </p>
          </CardHeader>

          <CardContent>
            {topMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <BarChart3 className="h-8 w-8 text-muted-foreground" />

                <p className="font-medium">
                  No Material Usage
                </p>

                <p className="text-sm text-muted-foreground">
                  No raw material usage recorded in this period.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topMaterials.map((item, index) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {item.name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {item.transactionCount} usage transactions
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-semibold">
                        {formatNumber(item.quantity)} {item.unit}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Total used
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Waste monitoring */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-600" />
                Waste Monitoring
              </CardTitle>

              <Badge
                variant={
                  wasteMonitoring.length > 0
                    ? "destructive"
                    : "secondary"
                }
              >
                {wasteMonitoring.length} Items
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">
              Items with recorded waste transactions.
            </p>
          </CardHeader>

          <CardContent>
            {topWaste.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <PackageCheck className="h-8 w-8 text-green-600" />

                <p className="font-medium">
                  No Waste Recorded
                </p>

                <p className="text-sm text-muted-foreground">
                  No waste transactions recorded in this period.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {topWaste.map((item, index) => (
                  <div
                    key={item.item_id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-sm font-semibold text-red-600">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {item.name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {item.transactionCount} waste transactions
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="font-semibold">
                        {formatNumber(item.quantity)} {item.unit}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Total wasted
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
