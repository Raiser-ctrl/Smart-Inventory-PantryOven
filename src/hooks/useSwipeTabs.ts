
"use client";

import {
  useRef,
  type PointerEvent,
} from "react";

type SwipeOptions = {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  disabled?: boolean;
  threshold?: number;
};

type SwipePoint = {
  x: number;
  y: number;
  pointerId: number;
  startedAt: number;
};

export function useSwipeTabs({
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
  threshold = 65,
}: SwipeOptions) {
  const start = useRef<SwipePoint | null>(null);

  function onPointerDown(
    event: PointerEvent<HTMLElement>
  ) {
    start.current = null;

    if (
      disabled ||
      !event.isPrimary ||
      event.pointerType !== "touch"
    ) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element)) return;

    if (
      target.closest(
        [
          "button",
          "a",
          "input",
          "select",
          "textarea",
          '[role="button"]',
          '[data-no-swipe]',
        ].join(",")
      )
    ) {
      return;
    }

    // Avoid horizontal scroll containers.
    const scrollContainer = target.closest(
      '[data-horizontal-scroll="true"]'
    );

    if (
      scrollContainer &&
      scrollContainer.scrollWidth >
        scrollContainer.clientWidth + 2
    ) {
      return;
    }

    // Preserve browser edge navigation.
    if (
      event.clientX < 28 ||
      event.clientX > window.innerWidth - 28
    ) {
      return;
    }

    start.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      startedAt: Date.now(),
    };
  }

  function onPointerUp(
    event: PointerEvent<HTMLElement>
  ) {
    const point = start.current;
    start.current = null;

    if (
      disabled ||
      !point ||
      point.pointerId !== event.pointerId
    ) {
      return;
    }

    const dx = event.clientX - point.x;
    const dy = event.clientY - point.y;

    if (
      Math.abs(dx) < threshold ||
      Math.abs(dx) <= Math.abs(dy) * 1.3 ||
      Date.now() - point.startedAt > 900
    ) {
      return;
    }

    if (dx < 0) {
      onSwipeLeft();
    } else {
      onSwipeRight();
    }
  }

  function onPointerCancel() {
    start.current = null;
  }

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
  };
}
