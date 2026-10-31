
import { requireAdmin } from "@/lib/auth";
import { getInventoryItems } from "@/lib/inventory";

import InventoryWorkspace from "@/components/inventory/InventoryWorkspace";

type InventoryStatus = "active" | "archived" | "all";

type InventoryPageProps = {
  searchParams: Promise<{
    status?: string | string[];
  }>;
};

export default async function InventoryPage({
  searchParams,
}: InventoryPageProps) {
  await requireAdmin();

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
      <main className="min-w-0 bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <div
            role="alert"
            className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 bg-background px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto min-w-0 max-w-7xl">
        <InventoryWorkspace
          key={initialStatus}
          items={items}
          initialStatus={initialStatus}
        />
      </div>
    </main>
  );
}
