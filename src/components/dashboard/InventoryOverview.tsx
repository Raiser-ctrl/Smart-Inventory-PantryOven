
"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
} from "react";
import Link from "next/link";

import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Package,
} from "lucide-react";

import type { ItemActivity } from "@/lib/inventory-analytics";

type Tab = "attention" | "inventory" | "usage" | "waste";

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
};

type Props = {
  items: InventoryItem[];
  topUsedMaterials: ItemActivity[];
  wasteMonitoring: ItemActivity[];
  period: 7 | 30;
};

const formatter = new Intl.NumberFormat("id-ID", {
  maximumFractionDigits: 2,
});

const tabs: { value: Tab; label: string }[] = [
  { value: "attention", label: "Attention" },
  { value: "inventory", label: "Inventory" },
  { value: "usage", label: "Usage" },
  { value: "waste", label: "Waste" },
];

const SWIPE_THRESHOLD = 65;
const VERTICAL_RATIO = 1.4;

function isLowStock(item: InventoryItem) {
  return item.current_stock <= item.minimum_stock;
}

export default function InventoryOverview({
  items,
  topUsedMaterials,
  wasteMonitoring,
}: Props) {
  const [activeTab, setActiveTab] =
    useState<Tab>("attention");

  const panelId = useId();
  const headingId = useId();

  const tabRefs = useRef<
    Partial<Record<Tab, HTMLButtonElement | null>>
  >({});

  const touchStart = useRef<{
    x: number;
    y: number;
  } | null>(null);

  const safeItems = Array.isArray(items) ? items : [];

  const safeUsage = Array.isArray(topUsedMaterials)
    ? topUsedMaterials
    : [];

  const safeWaste = Array.isArray(wasteMonitoring)
    ? wasteMonitoring
    : [];

  const lowStockItems = safeItems
    .filter(isLowStock)
    .sort(
      (a, b) =>
        a.current_stock -
        a.minimum_stock -
        (b.current_stock - b.minimum_stock)
    );

  const visibleItems =
    activeTab === "attention"
      ? lowStockItems.slice(0, 5)
      : activeTab === "inventory"
        ? [...safeItems]
            .sort((a, b) => {
              const aLow = isLowStock(a) ? 0 : 1;
              const bLow = isLowStock(b) ? 0 : 1;

              return aLow - bLow;
            })
            .slice(0, 5)
        : [];

  const activityItems =
    activeTab === "usage"
      ? safeUsage.slice(0, 5)
      : activeTab === "waste"
        ? safeWaste.slice(0, 5)
        : [];

  const isActivityTab =
    activeTab === "usage" ||
    activeTab === "waste";

  const changeTab = (nextTab: Tab, focus = false) => {
    setActiveTab(nextTab);

    const button = tabRefs.current[nextTab];

    button?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });

    if (focus) {
      button?.focus({ preventScroll: true });
    }
  };

  const moveTab = (direction: -1 | 1) => {
    const currentIndex = tabs.findIndex(
      (tab) => tab.value === activeTab
    );

    const nextIndex = Math.max(
      0,
      Math.min(
        tabs.length - 1,
        currentIndex + direction
      )
    );

    if (nextIndex !== currentIndex) {
      changeTab(tabs[nextIndex].value);
    }
  };

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    tab: Tab
  ) => {
    const currentIndex = tabs.findIndex(
      (entry) => entry.value === tab
    );

    let nextIndex: number;

    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % tabs.length;
        break;

      case "ArrowLeft":
        nextIndex =
          (currentIndex - 1 + tabs.length) %
          tabs.length;
        break;

      case "Home":
        nextIndex = 0;
        break;

      case "End":
        nextIndex = tabs.length - 1;
        break;

      default:
        return;
    }

    event.preventDefault();
    changeTab(tabs[nextIndex].value, true);
  };

  const handleTouchStart = (
    event: TouchEvent<HTMLDivElement>
  ) => {
    if (event.touches.length !== 1) {
      touchStart.current = null;
      return;
    }

    touchStart.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  };

  const handleTouchEnd = (
    event: TouchEvent<HTMLDivElement>
  ) => {
    const start = touchStart.current;
    touchStart.current = null;

    if (
      !start ||
      event.changedTouches.length !== 1
    ) {
      return;
    }

    const deltaX =
      event.changedTouches[0].clientX - start.x;

    const deltaY =
      event.changedTouches[0].clientY - start.y;

    if (
      Math.abs(deltaX) < SWIPE_THRESHOLD ||
      Math.abs(deltaX) <
        Math.abs(deltaY) * VERTICAL_RATIO
    ) {
      return;
    }

    moveTab(deltaX < 0 ? 1 : -1);
  };

  return (
    <section
      aria-labelledby={headingId}
      className="min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3.5 pt-4 sm:px-5 sm:pt-5">
        <Package
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />

        <h2
          id={headingId}
          className="text-sm font-semibold sm:text-base"
        >
          Inventory overview
        </h2>
      </div>

      {/* Tabs */}
      <div className="mt-3 border-b px-3 sm:px-5">
        <div
          role="tablist"
          aria-label="Inventory overview sections"
          className="flex gap-1 overflow-x-auto pb-2"
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.value;

            return (
              <button
                key={tab.value}
                ref={(element) => {
                  tabRefs.current[tab.value] = element;
                }}
                type="button"
                role="tab"
                id={`${panelId}-${tab.value}`}
                aria-selected={active}
                aria-controls={panelId}
                tabIndex={active ? 0 : -1}
                onClick={() =>
                  changeTab(tab.value)
                }
                onKeyDown={(event) =>
                  handleTabKeyDown(event, tab.value)
                }
                className={`min-h-11 shrink-0 rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Swipeable tab content */}
      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${panelId}-${activeTab}`}
        tabIndex={0}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => {
          touchStart.current = null;
        }}
        className="min-h-[120px] px-3.5 py-1 outline-none [touch-action:pan-y] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
      >
        {(activeTab === "attention" ||
          activeTab === "inventory") && (
          <>
            {visibleItems.length === 0 ? (
              <div className="flex min-h-[110px] items-center gap-2.5">
                <CheckCircle2
                  aria-hidden="true"
                  className="size-4 shrink-0 text-emerald-600"
                />

                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {safeItems.length === 0
                      ? "No inventory items found"
                      : activeTab === "attention"
                        ? "All stock levels are healthy"
                        : "No inventory items found"}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {safeItems.length === 0
                      ? "Add items to start tracking inventory."
                      : activeTab === "attention"
                        ? "No items need restocking."
                        : "There are no items to display."}
                  </p>
                </div>
              </div>
            ) : (
              <ul className="divide-y">
                {visibleItems.map((item) => {
                  const low = isLowStock(item);

                  return (
                    <li
                      key={item.id}
                      className="flex min-w-0 items-center justify-between gap-3 py-3"
                    >
                      <div className="flex min-w-0 items-start gap-2">
                        {low ? (
                          <AlertTriangle
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-amber-600"
                          />
                        ) : (
                          <CheckCircle2
                            aria-hidden="true"
                            className="mt-0.5 size-4 shrink-0 text-emerald-600"
                          />
                        )}

                        <div className="min-w-0">
                          <p
                            className="truncate text-sm font-medium"
                            title={item.name}
                          >
                            {item.name}
                          </p>

                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Min{" "}
                            {formatter.format(
                              item.minimum_stock
                            )}{" "}
                            {item.unit}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatter.format(
                            item.current_stock
                          )}{" "}
                          {item.unit}
                        </p>

                        {activeTab === "inventory" && (
                          <p
                            className={`mt-0.5 text-[11px] ${
                              low
                                ? "text-amber-600"
                                : "text-muted-foreground"
                            }`}
                          >
                            {low ? "Low stock" : "Healthy"}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {isActivityTab && (
          <>
            {activityItems.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                {activeTab === "usage"
                  ? "No material usage recorded in this period."
                  : "No waste recorded in this period."}
              </p>
            ) : (
              <ol className="divide-y">
                {activityItems.map((item, index) => (
                  <li
                    key={item.item_id}
                    className="flex min-w-0 items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
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

                    <span className="max-w-[45%] shrink-0 break-words text-right text-sm font-semibold tabular-nums">
                      {formatter.format(
                        item.quantity
                      )}{" "}
                      {item.unit}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t px-3.5 py-3 sm:px-5">
        <Link
          href={
            isActivityTab
              ? "/transactions"
              : "/inventory"
          }
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isActivityTab
            ? "View transactions"
            : "View inventory"}

          <ArrowUpRight
            aria-hidden="true"
            className="size-3.5"
          />
        </Link>
      </div>
    </section>
  );
}
