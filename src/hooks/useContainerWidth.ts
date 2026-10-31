
"use client";

import { useEffect, useRef, useState } from "react";

export function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;

    let frameId: number | null = null;
    let lastWidth = -1;
    let pendingWidth = 0;

    const updateWidth = (nextWidth: number) => {
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) {
        return;
      }

      const roundedWidth = Math.round(nextWidth);

      if (roundedWidth === lastWidth) {
        return;
      }

      pendingWidth = roundedWidth;

      if (frameId !== null) {
        return;
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;

        if (pendingWidth === lastWidth) {
          return;
        }

        lastWidth = pendingWidth;
        setWidth(pendingWidth);
      });
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (!entry) return;

      updateWidth(entry.contentRect.width);
    });

    observer.observe(element);

    // Use the same content-box measurement as ResizeObserver.
    const styles = window.getComputedStyle(element);

    const horizontalPadding =
      parseFloat(styles.paddingLeft) +
      parseFloat(styles.paddingRight);

    const horizontalBorder =
      parseFloat(styles.borderLeftWidth) +
      parseFloat(styles.borderRightWidth);

    const initialWidth =
      element.getBoundingClientRect().width -
      horizontalPadding -
      horizontalBorder;

    updateWidth(initialWidth);

    return () => {
      observer.disconnect();

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return { ref, width };
}
