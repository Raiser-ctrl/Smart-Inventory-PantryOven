
import { AlertCircle, ArrowRight, Package } from "lucide-react";
import Link from "next/link";

import { requireApprovedUser } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory";

import InventoryWorkspace from "@/components/inventory/InventoryWorkspace";

export const dynamic = "force-dynamic";

type InventoryStatus = "active" | "archived" | "all";

type InventoryPageProps = {
  searchParams: Promise<{
    status?: string | string[];
  }>;
};

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  // Only approved Admin and Staff accounts can access inventory.
  await requireApprovedUser();

  const params = await searchParams;

  const requestedStatus = Array.isArray(params.status)
    ? params.status[0]
    : params.status;

  const initialStatus: InventoryStatus =
    requestedStatus === "archived" ||
    requestedStatus === "all"
      ? requestedStatus
      : "active";

  let items: Awaited<
    ReturnType<typeof getInventoryItems>
  > = [];

  let errorMessage = "";

  try {
    items = await getInventoryItems();
  } catch (error) {
    console.error("Inventory page error:", error);

    errorMessage =
      "Data inventory belum dapat dimuat. Silakan coba lagi.";
  }

  if (errorMessage) {
    return (
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <div
          role="alert"
          className={[
            "relative overflow-hidden",
            "rounded-[26px]",
            "border border-[#C9857C]/20",
            "bg-white/50",
            "p-5 sm:p-7",
            "backdrop-blur-xl",
            "shadow-[0_10px_36px_rgba(52,59,50,0.045)]",
          ].join(" ")}
        >
          <div className="flex flex-col items-start gap-4 sm:flex-row">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#C9857C]/12 text-[#B76F67]">
              <AlertCircle
                aria-hidden="true"
                className="size-6"
              />
            </span>

            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold tracking-tight text-[#343B32]">
                Inventory unavailable
              </h1>

              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#7A8775]">
                {errorMessage}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  href={`/inventory?status=${initialStatus}`}
                  className={[
                    "inline-flex min-h-10 items-center",
                    "gap-2 rounded-xl",
                    "bg-[#8FA58A]",
                    "px-4 py-2",
                    "text-sm font-medium text-white",
                    "transition-colors",
                    "hover:bg-[#789174]",
                    "focus-visible:outline-2",
                    "focus-visible:outline-offset-2",
                    "focus-visible:outline-[#536D50]",
                  ].join(" ")}
                >
                  Try again
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4"
                  />
                </Link>

                <span className="inline-flex items-center gap-2 text-xs text-[#7A8775]">
                  <Package
                    aria-hidden="true"
                    className="size-4"
                  />
                  Your inventory data has not been changed.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl">
      <InventoryWorkspace
        key={initialStatus}
        items={items}
        initialStatus={initialStatus}
      />
    </div>
  );
}
