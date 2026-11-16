
"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  Archive,
  Check,
  CheckCircle2,
  CheckSquare2,
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

type ApiResponse = {
  success?: boolean;
  message?: string;
};

const TAB_ORDER: InventoryStatus[] = [
  "active",
  "archived",
  "all",
];

const formatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const glassCard =
  "min-w-0 overflow-hidden rounded-[26px] border border-white/55 bg-white/45 shadow-[0_10px_36px_rgba(52,59,50,0.045)] backdrop-blur-xl";

const softButton =
  "rounded-xl border-[#8FA58A]/20 bg-white/60 text-[#536D50] hover:bg-white/90 hover:text-[#343B32]";

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
    return (
      <span className="inline-flex rounded-full bg-[#7A8775]/10 px-2.5 py-1 text-[11px] font-medium text-[#7A8775]">
        Archived
      </span>
    );
  }

  if (isLowStock(item)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#D4AC72]/15 px-2.5 py-1 text-[11px] font-medium text-[#A77D3D]">
        <span className="size-1.5 rounded-full bg-[#D4AC72]" />
        Restock
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#8FA58A]/15 px-2.5 py-1 text-[11px] font-medium text-[#536D50]">
      <span className="size-1.5 rounded-full bg-[#8FA58A]" />
      Healthy
    </span>
  );
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

  const [pendingTargets, setPendingTargets] =
    useState<InventoryItem[]>([]);

  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [actionResult, setActionResult] =
    useState<ActionResult | null>(null);

  const processingRef = useRef(false);

  const holdTimer = useRef<
    ReturnType<typeof setTimeout> | null
  >(null);

  const holdStart = useRef({ x: 0, y: 0 });
  const longPressTriggered = useRef(false);
  const suppressNextClick = useRef(false);

  // Browser navigation synchronization
  useEffect(() => {
    function handlePopState() {
      if (processingRef.current) return;

      const params = new URLSearchParams(
        window.location.search
      );

      const value = params.get("status");

      const nextStatus: InventoryStatus =
        value === "archived" || value === "all"
          ? value
          : "active";

      setStatus(nextStatus);
      setSelectedIds([]);
      setActionResult(null);

      if (nextStatus === "archived") {
        setStockFilter("all");
      }
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener(
        "popstate",
        handlePopState
      );
    };
  }, []);

  useEffect(() => {
    const timerRef = holdTimer;

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // Inventory data
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

      if (status === "active" && archived) {
        return false;
      }

      if (status === "archived" && !archived) {
        return false;
      }

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
  }, [items, status, category, search, stockFilter]);

  const visibleIds = useMemo(
    () => filteredItems.map((item) => item.id),
    [filteredItems]
  );

  const selectedIdSet = useMemo(
    () => new Set(selectedIds),
    [selectedIds]
  );

  const selectedItems = useMemo(
    () =>
      filteredItems.filter((item) =>
        selectedIdSet.has(item.id)
      ),
    [filteredItems, selectedIdSet]
  );

  const selectedCount = selectedItems.length;

  const allSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIdSet.has(id));

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

  const interactionLocked =
    processing || pendingAction !== null;

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

  function resetSelectionForFilter() {
    setSelectedIds([]);
    setActionResult(null);
  }

  function clearSelection() {
    if (processingRef.current || pendingAction !== null) {
      return;
    }

    resetSelectionForFilter();
  }

  function exitSelection() {
    if (processingRef.current || pendingAction !== null) {
      return;
    }

    setSelectionMode(false);
    resetSelectionForFilter();
  }

  function toggleSelection(id: string) {
    if (processingRef.current || pendingAction !== null) {
      return;
    }

    setActionResult(null);

    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id]
    );
  }

  function enterSelection(id?: string) {
    if (processingRef.current || pendingAction !== null) {
      return;
    }

    setSelectionMode(true);
    setActionResult(null);
    setSelectedIds(id ? [id] : []);
  }

  function toggleSelectAll() {
    if (processingRef.current || pendingAction !== null) {
      return;
    }

    setActionResult(null);

    setSelectedIds((previous) => {
      if (allSelected) {
        const visible = new Set(visibleIds);

        return previous.filter(
          (id) => !visible.has(id)
        );
      }

      return [
        ...new Set([...previous, ...visibleIds]),
      ];
    });
  }

  function changeStatus(next: InventoryStatus) {
    if (
      status === next ||
      processingRef.current ||
      pendingAction !== null
    ) {
      return;
    }

    setStatus(next);
    resetSelectionForFilter();

    if (next === "archived") {
      setStockFilter("all");
    }

    const params = new URLSearchParams(
      window.location.search
    );

    if (next === "active") {
      params.delete("status");
    } else {
      params.set("status", next);
    }

    const query = params.toString();

    const url = query
      ? `/inventory?${query}`
      : "/inventory";

    window.history.replaceState(
      window.history.state,
      "",
      url
    );
  }

  function moveTab(direction: -1 | 1) {
    if (
      selectionMode ||
      interactionLocked ||
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
      interactionLocked ||
      editItem !== null,
  });

  function clearFilters() {
    if (processingRef.current || pendingAction !== null) {
      return;
    }

    setSearch("");
    setCategory("all");
    setStockFilter("all");
    resetSelectionForFilter();
  }

  // Long press selection
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
      interactionLocked ||
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
    event: MouseEvent<HTMLElement>
  ) {
    if (
      selectionMode ||
      longPressTriggered.current
    ) {
      event.preventDefault();
    }
  }

  // Bulk operations
  function openAction(action: BulkAction) {
    if (
      processingRef.current ||
      pendingAction !== null ||
      selectedCount === 0
    ) {
      return;
    }

    if (
      (action === "archive" && !canArchive) ||
      (action === "restore" && !canRestore) ||
      (action === "delete" && !canDelete)
    ) {
      return;
    }

    setPendingTargets([...selectedItems]);
    setPendingAction(action);
    setActionResult(null);
    setProgress(0);
  }

  function closeAction() {
    if (processingRef.current) return;

    setPendingAction(null);
    setPendingTargets([]);
    setProgress(0);
  }

  async function processBulkAction() {
    if (!pendingAction || processingRef.current) {
      return;
    }

    const action = pendingAction;
    const targets = [...pendingTargets];

    if (targets.length === 0) return;

    processingRef.current = true;
    setProcessing(true);
    setProgress(0);

    const failures: ActionFailure[] = [];
    let succeeded = 0;
    let completed = 0;

    try {
      for (const item of targets) {
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
            cache: "no-store",
          });

          const result: ApiResponse | null =
            await response.json().catch(() => null);

          if (
            !response.ok ||
            result?.success !== true
          ) {
            throw new Error(
              result?.message ??
                `Failed to ${action} item.`
            );
          }

          succeeded += 1;
        } catch (caughtError) {
          failures.push({
            id: item.id,
            name: item.name,
            message:
              caughtError instanceof Error
                ? caughtError.message
                : "Unexpected error.",
          });
        }

        completed += 1;
        setProgress(completed);
      }
    } catch (caughtError) {
      const remaining = targets.slice(completed);

      for (const item of remaining) {
        failures.push({
          id: item.id,
          name: item.name,
          message:
            caughtError instanceof Error
              ? caughtError.message
              : "Bulk operation interrupted.",
        });
      }
    } finally {
      processingRef.current = false;
      setProcessing(false);
      setPendingAction(null);
      setPendingTargets([]);
      setProgress(0);

      setActionResult({
        action,
        succeeded,
        failures,
      });

      setSelectedIds(
        failures.map((failure) => failure.id)
      );

      router.refresh();
    }
  }

  function renderBulkActions() {
    return (
      <>
        {canEdit && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={interactionLocked}
            onClick={() =>
              setEditItem(selectedItems[0])
            }
            className={softButton}
          >
            <Pencil className="mr-1.5 size-4" />
            Edit
          </Button>
        )}

        {canArchive && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={interactionLocked}
            onClick={() => openAction("archive")}
            className={softButton}
          >
            <Archive className="mr-1.5 size-4" />
            Archive
          </Button>
        )}

        {canRestore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={interactionLocked}
            onClick={() => openAction("restore")}
            className={softButton}
          >
            <RotateCcw className="mr-1.5 size-4" />
            Restore
          </Button>
        )}

        {canDelete && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={interactionLocked}
            className="rounded-xl border-[#C9857C]/25 bg-[#C9857C]/10 text-[#B76F67] hover:bg-[#C9857C]/15 hover:text-[#A65C55]"
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
    <div className="min-w-0 space-y-4 pb-28 lg:space-y-5 lg:pb-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-[#343B32] sm:text-3xl">
            Inventory
          </h1>

          <p className="mt-1 text-sm text-[#7A8775]">
            Manage your bakery stock.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StockTransactionDialog
            items={transactionItems}
          />

          <AddItemDialog />
        </div>
      </header>

      {/* Inventory container */}
      <section
        aria-label="Inventory items"
        className={glassCard}
      >
        <div className="space-y-3 p-3 sm:p-5">
          {/* Status tabs */}
          <div
            role="group"
            aria-label="Inventory status"
            className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-2xl border border-[#8FA58A]/10 bg-[#F8F6EF]/70 p-1"
          >
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                type="button"
                aria-pressed={status === tab.value}
                disabled={interactionLocked}
                onClick={() =>
                  changeStatus(tab.value)
                }
                className={`min-h-10 shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 sm:text-sm ${
                  status === tab.value
                    ? "bg-white/90 text-[#343B32] shadow-sm"
                    : "text-[#7A8775] hover:bg-white/50 hover:text-[#536D50]"
                }`}
              >
                {tab.label}

                <span className="ml-1.5 text-[11px] tabular-nums opacity-65">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search toolbar */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[#7A8775]"
              />

              <Input
                value={search}
                onChange={(event) => {
                  if (interactionLocked) return;

                  setSearch(event.target.value);
                  resetSelectionForFilter();
                }}
                disabled={interactionLocked}
                placeholder="Search items..."
                aria-label="Search inventory items"
                className="h-10 rounded-xl border-[#8FA58A]/15 bg-white/65 pl-9 text-[#343B32] placeholder:text-[#7A8775]/70 focus-visible:ring-[#8FA58A]/40"
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
              className={`h-10 shrink-0 rounded-xl border-[#8FA58A]/20 px-3 ${
                filtersOpen
                  ? "bg-[#8FA58A]/15 text-[#536D50]"
                  : "bg-white/60 text-[#536D50]"
              }`}
            >
              <SlidersHorizontal className="size-4" />

              <span className="hidden sm:inline">
                Filters
              </span>

              {activeFilterCount > 0 && (
                <span className="rounded-full bg-[#536D50] px-1.5 text-[10px] text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            <Button
              type="button"
              variant={
                selectionMode ? "secondary" : "outline"
              }
              size="sm"
              disabled={interactionLocked}
              onClick={() =>
                selectionMode
                  ? exitSelection()
                  : enterSelection()
              }
              className="h-10 shrink-0 rounded-xl border-[#8FA58A]/20 bg-white/60 px-3 text-[#536D50]"
            >
              {selectionMode ? (
                <>
                  <X className="size-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">
                    Cancel
                  </span>
                </>
              ) : (
                <>
                  <CheckSquare2 className="size-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">
                    Select
                  </span>
                </>
              )}
            </Button>
          </div>

          {/* Collapsible filters */}
          <div
            id="inventory-extra-filters"
            className={
              filtersOpen
                ? "grid grid-cols-1 gap-2 rounded-2xl bg-[#F8F6EF]/60 p-3 sm:grid-cols-2"
                : "hidden"
            }
          >
            <select
              value={category}
              onChange={(event) => {
                if (interactionLocked) return;

                setCategory(
                  event.target.value as CategoryFilter
                );

                resetSelectionForFilter();
              }}
              disabled={interactionLocked}
              aria-label="Filter by category"
              className="h-10 w-full min-w-0 rounded-xl border border-[#8FA58A]/20 bg-white/75 px-3 text-sm text-[#343B32] outline-none focus-visible:ring-2 focus-visible:ring-[#8FA58A]/40 disabled:opacity-50"
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
                if (interactionLocked) return;

                setStockFilter(
                  event.target.value as StockFilter
                );

                resetSelectionForFilter();
              }}
              disabled={
                status === "archived" ||
                interactionLocked
              }
              aria-label="Filter by stock health"
              className="h-10 w-full min-w-0 rounded-xl border border-[#8FA58A]/20 bg-white/75 px-3 text-sm text-[#343B32] outline-none focus-visible:ring-2 focus-visible:ring-[#8FA58A]/40 disabled:opacity-50"
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

          {/* Compact contextual information */}
          {(selectionMode || hasExtraFilters) && (
            <div className="flex min-h-8 flex-wrap items-center justify-between gap-2">
              {selectionMode ? (
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  disabled={
                    filteredItems.length === 0 ||
                    interactionLocked
                  }
                  className="inline-flex items-center gap-2 text-xs font-medium text-[#536D50] disabled:opacity-50"
                >
                  <span
                    className={`flex size-4 items-center justify-center rounded border ${
                      allSelected
                        ? "border-[#536D50] bg-[#536D50] text-white"
                        : "border-[#8FA58A]/35"
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
              ) : (
                <span className="text-xs tabular-nums text-[#7A8775]">
                  {filteredItems.length} results
                </span>
              )}

              {selectionMode ? (
                <span className="text-xs font-medium tabular-nums text-[#536D50]">
                  {selectedCount} selected
                </span>
              ) : (
                <button
                  type="button"
                  onClick={clearFilters}
                  disabled={interactionLocked}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#536D50] hover:underline disabled:opacity-50"
                >
                  <X className="size-3.5" />
                  Clear filters
                </button>
              )}
            </div>
          )}

          {/* Desktop bulk toolbar */}
          {selectionMode && selectedCount > 0 && (
            <div className="hidden items-center justify-between gap-3 rounded-2xl border border-[#8FA58A]/15 bg-[#F8F6EF]/65 px-3 py-2.5 md:flex">
              <span className="text-sm font-medium text-[#343B32]">
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
              <p className="text-xs text-[#7A8775]">
                Select items with the same archive status
                to perform a bulk action.
              </p>
            )}

          {/* Bulk action result */}
          {actionResult && (
            <div
              role="status"
              className="space-y-2 rounded-2xl border border-[#8FA58A]/20 bg-white/65 p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium text-[#343B32]">
                  {actionLabel(actionResult.action)}:{" "}
                  {actionResult.succeeded} succeeded,{" "}
                  {actionResult.failures.length} failed
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setActionResult(null)
                  }
                  aria-label="Dismiss result"
                  className="shrink-0 text-[#7A8775] hover:text-[#343B32]"
                >
                  <X className="size-4" />
                </button>
              </div>

              {actionResult.failures.length > 0 && (
                <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-[#B76F67]">
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
            </div>
          )}
        </div>

        {/* Desktop inventory table */}
        <div
          {...swipeTabs}
          onPointerDown={(event) => {
            if (
              event.currentTarget.scrollWidth >
              event.currentTarget.clientWidth + 2
            ) {
              swipeTabs.onPointerCancel();
              return;
            }

            swipeTabs.onPointerDown(event);
          }}
          className="hidden overflow-x-auto border-t border-[#8FA58A]/10 md:block"
        >
          <Table>
            <TableHeader>
              <TableRow className="border-[#8FA58A]/10 bg-[#F8F6EF]/35 hover:bg-[#F8F6EF]/35">
                {selectionMode && (
                  <TableHead className="w-10 pl-5">
                    <span className="sr-only">
                      Select
                    </span>
                  </TableHead>
                )}

                <TableHead className="pl-5 text-xs font-medium text-[#7A8775]">
                  Item
                </TableHead>

                <TableHead className="text-xs font-medium text-[#7A8775]">
                  Category
                </TableHead>

                <TableHead className="text-xs font-medium text-[#7A8775]">
                  Current stock
                </TableHead>

                <TableHead className="text-xs font-medium text-[#7A8775]">
                  Minimum
                </TableHead>

                <TableHead className="pr-5 text-xs font-medium text-[#7A8775]">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {filteredItems.map((item) => {
                const archived = isArchived(item);
                const selected = selectedIdSet.has(
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
                    className={[
                      "border-[#8FA58A]/10",
                      "transition-colors",
                      archived
                        ? "bg-[#F8F6EF]/35"
                        : "",
                      selectionMode
                        ? "cursor-pointer select-none"
                        : "",
                      selected
                        ? "bg-[#8FA58A]/10 hover:bg-[#8FA58A]/15"
                        : "hover:bg-white/45",
                    ].join(" ")}
                  >
                    {selectionMode && (
                      <TableCell className="pl-5">
                        <span
                          className={`flex size-4 items-center justify-center rounded border ${
                            selected
                              ? "border-[#536D50] bg-[#536D50] text-white"
                              : "border-[#8FA58A]/35"
                          }`}
                        >
                          {selected && (
                            <Check className="size-3" />
                          )}
                        </span>
                      </TableCell>
                    )}

                    <TableCell className="py-3.5 pl-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#8FA58A]/10 text-[#536D50]">
                          {item.category ===
                          "raw_material" ? (
                            <Wheat className="size-4" />
                          ) : (
                            <Package className="size-4" />
                          )}
                        </span>

                        <span
                          className="max-w-[220px] truncate text-sm font-medium text-[#343B32]"
                          title={item.name}
                        >
                          {item.name}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-sm text-[#7A8775]">
                      {categoryLabel(item.category)}
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-sm font-semibold tabular-nums text-[#343B32]">
                      {formatter.format(
                        Number(item.current_stock)
                      )}{" "}
                      {item.unit}
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-sm tabular-nums text-[#7A8775]">
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
                    colSpan={selectionMode ? 6 : 5}
                    className="h-36 text-center"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Package className="size-7 text-[#8FA58A]/60" />

                      <p className="text-sm font-medium text-[#343B32]">
                        No items found
                      </p>

                      <p className="text-xs text-[#7A8775]">
                        {hasExtraFilters
                          ? "Try adjusting your search or filters."
                          : "No inventory items in this view."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile inventory list */}
        <div
          {...swipeTabs}
          className="divide-y divide-[#8FA58A]/10 border-t border-[#8FA58A]/10 md:hidden"
        >
          {filteredItems.map((item) => {
            const selected = selectedIdSet.has(
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
                    !interactionLocked &&
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
                aria-disabled={
                  selectionMode && interactionLocked
                    ? true
                    : undefined
                }
                tabIndex={
                  selectionMode ? 0 : undefined
                }
                className={[
                  "px-4 py-3.5",
                  "transition-colors",
                  isArchived(item)
                    ? "bg-[#F8F6EF]/35"
                    : "",
                  selectionMode
                    ? "cursor-pointer select-none"
                    : "",
                  selected
                    ? "bg-[#8FA58A]/10"
                    : "",
                ].join(" ")}
              >
                <div className="flex min-w-0 items-center gap-3">
                  {selectionMode && (
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded border ${
                        selected
                          ? "border-[#536D50] bg-[#536D50] text-white"
                          : "border-[#8FA58A]/35"
                      }`}
                    >
                      {selected && (
                        <Check className="size-3.5" />
                      )}
                    </span>
                  )}

                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#8FA58A]/10 text-[#536D50]">
                    {item.category === "raw_material" ? (
                      <Wheat className="size-[18px]" />
                    ) : (
                      <Package className="size-[18px]" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-[#343B32]">
                      {item.name}
                    </p>

                    <p className="mt-1 text-xs text-[#7A8775]">
                      {categoryLabel(item.category)}
                    </p>

                    <p className="mt-1 text-[11px] text-[#7A8775]/80">
                      Min{" "}
                      {formatter.format(
                        Number(item.minimum_stock)
                      )}{" "}
                      {item.unit}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-semibold tabular-nums text-[#343B32]">
                      {formatter.format(
                        Number(item.current_stock)
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
            <div className="px-4 py-12 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#8FA58A]/10 text-[#536D50]">
                {status === "active" &&
                !hasExtraFilters ? (
                  <CheckCircle2 className="size-6" />
                ) : (
                  <Package className="size-6" />
                )}
              </span>

              <p className="mt-3 text-sm font-semibold text-[#343B32]">
                No items found
              </p>

              <p className="mt-1 text-xs text-[#7A8775]">
                {hasExtraFilters
                  ? "Try adjusting your search or filters."
                  : "No inventory items in this view."}
              </p>

              {hasExtraFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  disabled={interactionLocked}
                  className={`mt-4 ${softButton}`}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Mobile bulk toolbar */}
      {selectionMode && selectedCount > 0 && (
        <div className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 rounded-[20px] border border-white/60 bg-[#FAF7F0]/95 p-3 shadow-[0_12px_36px_rgba(52,59,50,0.15)] backdrop-blur-xl md:hidden">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#343B32]">
              {selectedCount} selected
            </span>

            <button
              type="button"
              onClick={clearSelection}
              disabled={interactionLocked}
              className="text-xs text-[#7A8775] disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {renderBulkActions()}
          </div>
        </div>
      )}

      {/* Edit item dialog */}
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
          if (!nextOpen) {
            closeAction();
          }
        }}
      >
        <AlertDialogContent className="max-w-md rounded-[24px] border border-white/60 bg-[#FAF7F0]/95 backdrop-blur-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#343B32]">
              {pendingAction
                ? `${actionLabel(
                    pendingAction
                  )} ${pendingTargets.length} items?`
                : "Confirm action"}
            </AlertDialogTitle>

            <AlertDialogDescription className="text-[#7A8775]">
              {pendingAction === "delete"
                ? "Selected items will be permanently deleted. Items with transaction history cannot be deleted. This action cannot be undone."
                : pendingAction === "archive"
                  ? "Selected items will be removed from active inventory. Transaction history will remain saved."
                  : "Selected items will be restored to active inventory."}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-40 overflow-y-auto rounded-2xl bg-[#8FA58A]/10 p-3">
            <ul className="space-y-1 text-sm text-[#343B32]">
              {pendingTargets.map((item) => (
                <li key={item.id}>
                  {item.name}
                </li>
              ))}
            </ul>
          </div>

          {processing && (
            <p
              role="status"
              className="flex items-center gap-2 text-sm text-[#7A8775]"
            >
              <Loader2 className="size-4 animate-spin" />
              Processing {progress} of{" "}
              {pendingTargets.length}...
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={processing}
              className={softButton}
            >
              Cancel
            </AlertDialogCancel>

            <AlertDialogAction
              disabled={
                processing ||
                pendingTargets.length === 0
              }
              className={
                pendingAction === "delete"
                  ? "bg-[#B76F67] text-white hover:bg-[#A65C55]"
                  : "bg-[#536D50] text-white hover:bg-[#435A40]"
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
