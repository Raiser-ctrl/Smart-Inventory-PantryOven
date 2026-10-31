
"use client";

import {
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  Archive,
  Check,
  CheckSquare2,
  History,
  Loader2,
  Package,
  Pencil,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Wheat,
  X,
} from "lucide-react";

import { AddItemDialog } from "@/components/inventory/AddItemDialog";
import { EditItemDialog } from "@/components/inventory/EditItemDialog";
import StockTransactionDialog from "@/components/inventory/StockTransactionDialog";
import { useSwipeTabs } from "@/hooks/useSwipeTabs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { getInventoryItems } from "@/lib/inventory";

type InventoryItem = Awaited<
  ReturnType<typeof getInventoryItems>
>[number];

type InventoryStatus = "active" | "archived" | "all";

type CategoryFilter =
  | "all"
  | "raw_material"
  | "finished_product";

type StockFilter = "all" | "low" | "healthy";
type BulkAction = "archive" | "restore" | "delete";

type Props = {
  items: InventoryItem[];
  initialStatus: InventoryStatus;
};

type ActionFailure = {
  id: string;
  name: string;
  message: string;
};

type ActionResult = {
  action: BulkAction;
  succeeded: number;
  failures: ActionFailure[];
};

const TAB_ORDER: InventoryStatus[] = [
  "active",
  "archived",
  "all",
];

const formatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

function isArchived(item: InventoryItem) {
  return item.archived_at !== null;
}

function isLowStock(item: InventoryItem) {
  return (
    Number(item.current_stock) <=
    Number(item.minimum_stock)
  );
}

function categoryLabel(
  category: InventoryItem["category"]
) {
  return category === "raw_material"
    ? "Raw material"
    : "Finished product";
}

function StockStatus({
  item,
}: {
  item: InventoryItem;
}) {
  if (isArchived(item)) {
    return <Badge variant="outline">Archived</Badge>;
  }

  if (isLowStock(item)) {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
      >
        Restock
      </Badge>
    );
  }

  return <Badge variant="secondary">Healthy</Badge>;
}

function actionLabel(action: BulkAction) {
  switch (action) {
    case "archive":
      return "Archive";
    case "restore":
      return "Restore";
    case "delete":
      return "Delete";
  }
}

export default function InventoryWorkspace({
  items,
  initialStatus,
}: Props) {
  const router = useRouter();

  const [status, setStatus] =
    useState<InventoryStatus>(initialStatus);

  const [search, setSearch] = useState("");

  const [category, setCategory] =
    useState<CategoryFilter>("all");

  const [stockFilter, setStockFilter] =
    useState<StockFilter>("all");

  const [filtersOpen, setFiltersOpen] =
    useState(false);

  const [selectionMode, setSelectionMode] =
    useState(false);

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  const [editItem, setEditItem] =
    useState<InventoryItem | null>(null);

  const [pendingAction, setPendingAction] =
    useState<BulkAction | null>(null);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [actionResult, setActionResult] =
    useState<ActionResult | null>(null);

  // Touch gesture state
  const holdTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const holdStart = useRef({ x: 0, y: 0 });
  const longPressTriggered = useRef(false);
  const suppressNextClick = useRef(false);

  const activeItems = useMemo(
    () => items.filter((item) => !isArchived(item)),
    [items]
  );

  const archivedItems = useMemo(
    () => items.filter(isArchived),
    [items]
  );

  const lowStockCount = useMemo(
    () => activeItems.filter(isLowStock).length,
    [activeItems]
  );

  const transactionItems = useMemo(
    () =>
      activeItems.map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        current_stock: Number(item.current_stock),
      })),
    [activeItems]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return items.filter((item) => {
      const archived = isArchived(item);

      if (status === "active" && archived) return false;
      if (status === "archived" && !archived) return false;

      if (
        category !== "all" &&
        item.category !== category
      ) {
        return false;
      }

      if (
        query &&
        !item.name.toLowerCase().includes(query)
      ) {
        return false;
      }

      if (stockFilter !== "all") {
        if (archived) return false;

        const low = isLowStock(item);

        if (stockFilter === "low" && !low) {
          return false;
        }

        if (stockFilter === "healthy" && low) {
          return false;
        }
      }

      return true;
    });
  }, [
    items,
    status,
    category,
    search,
    stockFilter,
  ]);

  const visibleIds = useMemo(
    () => filteredItems.map((item) => item.id),
    [filteredItems]
  );

  const selectedItems = useMemo(
    () =>
      filteredItems.filter((item) =>
        selectedIds.includes(item.id)
      ),
    [filteredItems, selectedIds]
  );

  const selectedCount = selectedItems.length;

  const allSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIds.includes(id));

  const hasActiveSelection = selectedItems.some(
    (item) => !isArchived(item)
  );

  const hasArchivedSelection =
    selectedItems.some(isArchived);

  const canEdit =
    selectedCount === 1 &&
    !isArchived(selectedItems[0]);

  const canArchive =
    selectedCount > 0 && !hasArchivedSelection;

  const canRestore =
    selectedCount > 0 && !hasActiveSelection;

  const canDelete =
    selectedCount > 0 && !hasArchivedSelection;

  const statusTabs = [
    {
      value: "active" as const,
      label: "Active",
      count: activeItems.length,
    },
    {
      value: "archived" as const,
      label: "Archived",
      count: archivedItems.length,
    },
    {
      value: "all" as const,
      label: "All",
      count: items.length,
    },
  ];

  const hasExtraFilters =
    search.trim() !== "" ||
    category !== "all" ||
    stockFilter !== "all";

  const activeFilterCount =
    Number(category !== "all") +
    Number(stockFilter !== "all");

  function clearSelection() {
    setSelectedIds([]);
    setActionResult(null);
  }

  function exitSelection() {
    setSelectionMode(false);
    clearSelection();
  }

  function toggleSelection(id: string) {
    setActionResult(null);

    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id]
    );
  }

  function enterSelection(id?: string) {
    setSelectionMode(true);
    setActionResult(null);
    setSelectedIds(id ? [id] : []);
  }

  function toggleSelectAll() {
    setActionResult(null);

    setSelectedIds(allSelected ? [] : visibleIds);
  }

  function resetSelectionForFilter() {
    setSelectedIds([]);
    setActionResult(null);
  }

  function changeStatus(next: InventoryStatus) {
    if (status === next) return;

    setStatus(next);
    resetSelectionForFilter();

    if (next === "archived") {
      setStockFilter("all");
    }

    const url =
      next === "active"
        ? "/inventory"
        : `/inventory?status=${next}`;

    window.history.replaceState(null, "", url);
  }

  function moveTab(direction: -1 | 1) {
    if (
      selectionMode ||
      processing ||
      pendingAction !== null ||
      editItem !== null
    ) {
      return;
    }

    const currentIndex = TAB_ORDER.indexOf(status);
    const nextIndex = currentIndex + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= TAB_ORDER.length
    ) {
      return;
    }

    changeStatus(TAB_ORDER[nextIndex]);
  }

  const swipeTabs = useSwipeTabs({
    onSwipeLeft: () => moveTab(1),
    onSwipeRight: () => moveTab(-1),
    disabled:
      selectionMode ||
      processing ||
      pendingAction !== null ||
      editItem !== null,
  });

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setStockFilter("all");
    resetSelectionForFilter();
  }

  function cancelHold() {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function handlePointerDown(
    event: PointerEvent<HTMLElement>,
    id: string
  ) {
    cancelHold();

    if (
      selectionMode ||
      processing ||
      pendingAction !== null ||
      editItem !== null ||
      event.pointerType !== "touch" ||
      !event.isPrimary
    ) {
      return;
    }

    longPressTriggered.current = false;
    suppressNextClick.current = false;

    holdStart.current = {
      x: event.clientX,
      y: event.clientY,
    };

    holdTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      suppressNextClick.current = true;
      enterSelection(id);
      holdTimer.current = null;
    }, 500);
  }

  function handlePointerMove(
    event: PointerEvent<HTMLElement>
  ) {
    if (holdTimer.current === null) return;

    const distance = Math.hypot(
      event.clientX - holdStart.current.x,
      event.clientY - holdStart.current.y
    );

    if (distance > 10) {
      cancelHold();
    }
  }

  function handlePointerUp() {
    cancelHold();
  }

  function handlePointerCancel() {
    cancelHold();
  }

  function handleRowClick(id: string) {
    if (
      longPressTriggered.current ||
      suppressNextClick.current
    ) {
      longPressTriggered.current = false;
      suppressNextClick.current = false;
      return;
    }

    if (selectionMode) {
      toggleSelection(id);
    }
  }

  function handleContextMenu(
    event: React.MouseEvent<HTMLElement>
  ) {
    if (
      selectionMode ||
      longPressTriggered.current
    ) {
      event.preventDefault();
    }
  }

  function openAction(action: BulkAction) {
    if (processing || selectedCount === 0) return;

    if (
      (action === "archive" && !canArchive) ||
      (action === "restore" && !canRestore) ||
      (action === "delete" && !canDelete)
    ) {
      return;
    }

    setPendingAction(action);
    setActionResult(null);
    setProgress(0);
  }

  async function processBulkAction() {
    if (!pendingAction || processing) return;

    const action = pendingAction;
    const targets = [...selectedItems];

    if (targets.length === 0) return;

    setProcessing(true);
    setProgress(0);

    const failures: ActionFailure[] = [];
    let succeeded = 0;

    for (const [index, item] of targets.entries()) {
      try {
        const encodedId = encodeURIComponent(item.id);

        const endpoint =
          action === "delete"
            ? `/api/v1/items/${encodedId}`
            : `/api/v1/items/${encodedId}/${action}`;

        const response = await fetch(endpoint, {
          method:
            action === "delete" ? "DELETE" : "POST",
          credentials: "same-origin",
        });

        const result: {
          success?: boolean;
          message?: string;
        } = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ??
              `Failed to ${action} item.`
          );
        }

        succeeded += 1;
      } catch (error) {
        failures.push({
          id: item.id,
          name: item.name,
          message:
            error instanceof Error
              ? error.message
              : "Unexpected error.",
        });
      }

      setProgress(index + 1);
    }

    setProcessing(false);
    setPendingAction(null);

    setActionResult({
      action,
      succeeded,
      failures,
    });

    setSelectedIds(
      failures.map((item) => item.id)
    );

    router.refresh();
  }

  const actionTargets = selectedItems;

  // Shared action buttons for desktop/tablet/mobile.
  function renderBulkActions() {
    return (
      <>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setEditItem(selectedItems[0])
            }
          >
            <Pencil className="mr-1.5 size-4" />
            Edit
          </Button>
        )}

        {canArchive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAction("archive")}
          >
            <Archive className="mr-1.5 size-4" />
            Archive
          </Button>
        )}

        {canRestore && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAction("restore")}
          >
            <RotateCcw className="mr-1.5 size-4" />
            Restore
          </Button>
        )}

        {canDelete && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => openAction("delete")}
          >
            <Trash2 className="mr-1.5 size-4" />
            Delete
          </Button>
        )}
      </>
    );
  }

  return (
    <div className="min-w-0 space-y-4 pb-20 lg:space-y-6 lg:pb-0">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Inventory
          </h1>

          {lowStockCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="size-3.5" />
              {lowStockCount} need attention
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StockTransactionDialog
            items={transactionItems}
          />

          <AddItemDialog />

          <Button
            variant="outline"
            size="sm"
            asChild
            className="ml-auto"
          >
            <Link href="/transactions">
              <History className="mr-1.5 size-4" />
              History
            </Link>
          </Button>
        </div>
      </header>

      <section
        aria-label="Inventory items"
        className="min-w-0 overflow-hidden rounded-xl border bg-card"
      >
        <div className="space-y-3 p-3 sm:p-5">
          {/* Status tabs */}
          <div
            role="group"
            aria-label="Inventory status"
            className="flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1"
          >
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={status === tab.value}
                onClick={() =>
                  changeStatus(tab.value)
                }
                className={`min-h-9 shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                  status === tab.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}

                <span className="ml-1.5 text-muted-foreground tabular-nums">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search and selection */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetSelectionForFilter();
                }}
                placeholder="Search items..."
                aria-label="Search inventory items"
                className="pl-9"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={filtersOpen}
              aria-controls="inventory-extra-filters"
              onClick={() =>
                setFiltersOpen((value) => !value)
              }
              className="shrink-0 md:hidden"
            >
              <SlidersHorizontal className="size-4" />

              <span className="hidden min-[380px]:inline">
                Filters
              </span>

              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            <Button
              type="button"
              variant={
                selectionMode
                  ? "secondary"
                  : "outline"
              }
              size="sm"
              onClick={() =>
                selectionMode
                  ? exitSelection()
                  : enterSelection()
              }
              className="shrink-0"
            >
              {selectionMode ? (
                <>
                  <X className="size-4 sm:mr-1.5" />
                  <span>Cancel</span>
                </>
              ) : (
                <>
                  <CheckSquare2 className="size-4 sm:mr-1.5" />
                  <span>Select</span>
                </>
              )}
            </Button>
          </div>

          {/* Filters */}
          <div
            id="inventory-extra-filters"
            className={`grid gap-2 ${
              filtersOpen
                ? "grid-cols-1 sm:grid-cols-2"
                : "hidden"
            } md:grid md:grid-cols-2`}
          >
            <select
              value={category}
              onChange={(event) => {
                setCategory(
                  event.target.value as CategoryFilter
                );
                resetSelectionForFilter();
              }}
              aria-label="Filter by category"
              className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">
                All categories
              </option>
              <option value="raw_material">
                Raw materials
              </option>
              <option value="finished_product">
                Finished products
              </option>
            </select>

            <select
              value={stockFilter}
              onChange={(event) => {
                setStockFilter(
                  event.target.value as StockFilter
                );
                resetSelectionForFilter();
              }}
              disabled={status === "archived"}
              aria-label="Filter by stock health"
              className="h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="all">
                All stock levels
              </option>
              <option value="low">
                Need restock
              </option>
              <option value="healthy">
                Healthy
              </option>
            </select>
          </div>

          {/* Selection controls */}
          {selectionMode && (
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={filteredItems.length === 0}
                className="inline-flex min-h-8 items-center gap-2 text-xs font-medium disabled:opacity-50"
              >
                <span
                  className={`flex size-4 items-center justify-center rounded border ${
                    allSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input"
                  }`}
                >
                  {allSelected && (
                    <Check className="size-3" />
                  )}
                </span>

                {allSelected
                  ? "Deselect all"
                  : "Select all"}
              </button>

              <span className="text-xs text-muted-foreground tabular-nums">
                {selectedCount} selected
              </span>
            </div>
          )}

          {/* Filter results */}
          {hasExtraFilters && !selectionMode && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">
                {filteredItems.length} results
              </span>

              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <X className="size-3.5" />
                Clear filters
              </button>
            </div>
          )}

          {/* Tablet and desktop bulk toolbar */}
          {selectionMode && selectedCount > 0 && (
            <div className="hidden items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2.5 md:flex">
              <span className="text-sm font-medium">
                {selectedCount} selected
              </span>

              <div className="flex flex-wrap gap-2">
                {renderBulkActions()}
              </div>
            </div>
          )}

          {selectionMode &&
            selectedCount > 0 &&
            !canArchive &&
            !canRestore &&
            !canDelete && (
              <p className="text-xs text-muted-foreground">
                Select items with the same archive status
                to perform a bulk action.
              </p>
            )}

          {/* Bulk result */}
          {actionResult && (
            <div
              role="status"
              className="space-y-2 rounded-lg border px-3 py-2.5 text-sm"
            >
              <p className="font-medium">
                {actionLabel(actionResult.action)}:{" "}
                {actionResult.succeeded} succeeded,{" "}
                {actionResult.failures.length} failed
              </p>

              {actionResult.failures.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
                  {actionResult.failures.map(
                    (failure) => (
                      <li key={failure.id}>
                        {failure.name}:{" "}
                        {failure.message}
                      </li>
                    )
                  )}
                </ul>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActionResult(null)}
              >
                Dismiss
              </Button>
            </div>
          )}
        </div>

        {/* Tablet and desktop table */}
        <div
          {...swipeTabs}
          onPointerDown={(event) => {
            // Preserve horizontal table scrolling.
            if (
              event.currentTarget.scrollWidth >
              event.currentTarget.clientWidth + 2
            ) {
              swipeTabs.onPointerCancel();
              return;
            }

            swipeTabs.onPointerDown(event);
          }}
          className="hidden overflow-x-auto border-t md:block"
        >
          <Table>
            <TableHeader>
              <TableRow>
                {selectionMode && (
                  <TableHead className="w-10 pl-5">
                    <span className="sr-only">
                      Select
                    </span>
                  </TableHead>
                )}

                <TableHead className="pl-5">
                  Item
                </TableHead>

                <TableHead>Category</TableHead>
                <TableHead>Current stock</TableHead>
                <TableHead>Minimum</TableHead>

                <TableHead className="pr-5">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredItems.map((item) => {
                const archived = isArchived(item);
                const selected = selectedIds.includes(
                  item.id
                );

                return (
                  <TableRow
                    key={item.id}
                    aria-selected={
                      selectionMode
                        ? selected
                        : undefined
                    }
                    onPointerDown={(event) =>
                      handlePointerDown(
                        event,
                        item.id
                      )
                    }
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={
                      handlePointerCancel
                    }
                    onContextMenu={
                      handleContextMenu
                    }
                    onClick={() =>
                      handleRowClick(item.id)
                    }
                    className={`${
                      archived
                        ? "bg-muted/20 "
                        : ""
                    }${
                      selectionMode
                        ? "cursor-pointer select-none "
                        : ""
                    }${
                      selected
                        ? "bg-primary/5 hover:bg-primary/10"
                        : ""
                    }`}
                  >
                    {selectionMode && (
                      <TableCell className="pl-5">
                        <span
                          className={`flex size-4 items-center justify-center rounded border ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input"
                          }`}
                        >
                          {selected && (
                            <Check className="size-3" />
                          )}
                        </span>
                      </TableCell>
                    )}

                    <TableCell className="pl-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          {item.category ===
                          "raw_material" ? (
                            <Wheat className="size-4 text-muted-foreground" />
                          ) : (
                            <Package className="size-4 text-muted-foreground" />
                          )}
                        </div>

                        <span className="max-w-[220px] truncate font-medium">
                          {item.name}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      {categoryLabel(
                        item.category
                      )}
                    </TableCell>

                    <TableCell className="whitespace-nowrap font-medium tabular-nums">
                      {formatter.format(
                        Number(item.current_stock)
                      )}{" "}
                      {item.unit}
                    </TableCell>

                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {formatter.format(
                        Number(item.minimum_stock)
                      )}{" "}
                      {item.unit}
                    </TableCell>

                    <TableCell className="pr-5">
                      <StockStatus item={item} />
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredItems.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={
                      selectionMode ? 6 : 5
                    }
                    className="h-32 text-center text-sm text-muted-foreground"
                  >
                    No matching inventory items found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile inventory list */}
        <div
          {...swipeTabs}
          className="divide-y border-t md:hidden"
        >
          {filteredItems.map((item) => {
            const selected = selectedIds.includes(
              item.id
            );

            return (
              <article
                key={item.id}
                onPointerDown={(event) =>
                  handlePointerDown(
                    event,
                    item.id
                  )
                }
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={
                  handlePointerCancel
                }
                onContextMenu={
                  handleContextMenu
                }
                onClick={() =>
                  handleRowClick(item.id)
                }
                onKeyDown={(event) => {
                  if (
                    selectionMode &&
                    (event.key === "Enter" ||
                      event.key === " ")
                  ) {
                    event.preventDefault();
                    toggleSelection(item.id);
                  }
                }}
                role={
                  selectionMode
                    ? "checkbox"
                    : undefined
                }
                aria-checked={
                  selectionMode
                    ? selected
                    : undefined
                }
                tabIndex={
                  selectionMode ? 0 : undefined
                }
                className={`px-3.5 py-3 transition-colors ${
                  isArchived(item)
                    ? "bg-muted/20 "
                    : ""
                }${
                  selectionMode
                    ? "cursor-pointer select-none "
                    : ""
                }${
                  selected
                    ? "bg-primary/5"
                    : ""
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {selectionMode && (
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {selected && (
                        <Check className="size-3.5" />
                      )}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold">
                      {item.name}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {categoryLabel(
                        item.category
                      )}
                      {" · "}
                      Min{" "}
                      {formatter.format(
                        Number(
                          item.minimum_stock
                        )
                      )}{" "}
                      {item.unit}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatter.format(
                        Number(
                          item.current_stock
                        )
                      )}{" "}
                      {item.unit}
                    </span>

                    <StockStatus item={item} />
                  </div>
                </div>
              </article>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="px-4 py-10 text-center">
              <Package className="mx-auto mb-3 size-8 text-muted-foreground/50" />

              <p className="text-sm font-medium">
                No items found
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                Try adjusting your search or filters.
              </p>

              {hasExtraFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  className="mt-4"
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Mobile contextual toolbar */}
      {selectionMode && selectedCount > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-40 rounded-xl border bg-card p-3 shadow-xl md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedCount} selected
            </span>

            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-muted-foreground"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {renderBulkActions()}
          </div>
        </div>
      )}

      {/* Controlled edit dialog */}
      {editItem && (
        <EditItemDialog
          key={editItem.id}
          item={{
            id: editItem.id,
            name: editItem.name,
            category: editItem.category,
            unit: editItem.unit,
            minimum_stock: Number(
              editItem.minimum_stock
            ),
          }}
          open
          hideTrigger
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setEditItem(null);
            }
          }}
          onSuccess={() => {
            setEditItem(null);
            exitSelection();
          }}
        />
      )}

      {/* Bulk confirmation */}
      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !processing) {
            setPendingAction(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction
                ? `${actionLabel(
                    pendingAction
                  )} ${actionTargets.length} items?`
                : "Confirm action"}
            </AlertDialogTitle>

            <AlertDialogDescription>
              {pendingAction === "delete"
                ? "Selected items will be permanently deleted. Items with transaction history cannot be deleted. This action cannot be undone."
                : pendingAction === "archive"
                  ? "Selected items will be removed from active inventory. Transaction history will remain saved."
                  : "Selected items will be restored to active inventory."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/50 p-3">
            <ul className="space-y-1 text-sm">
              {actionTargets.map((item) => (
                <li key={item.id}>
                  {item.name}
                </li>
              ))}
            </ul>
          </div>

          {processing && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 animate-spin" />
              Processing {progress} of{" "}
              {actionTargets.length}...
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={processing}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={processing}
              className={
                pendingAction === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              onClick={(event) => {
                event.preventDefault();
                void processBulkAction();
              }}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : pendingAction ? (
                `${actionLabel(
                  pendingAction
                )} items`
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
