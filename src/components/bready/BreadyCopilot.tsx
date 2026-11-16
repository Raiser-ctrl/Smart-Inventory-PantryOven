"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import BreadyMascot from "./BreadyMascot";
import BreadyChatPanel from "./BreadyChatPanel";

type Position = {
  x: number;
  y: number;
};

const MASCOT_SIZE = 88;
const EDGE_GAP = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function boundPosition(x: number, y: number): Position {
  if (typeof window === "undefined") {
    return { x, y };
  }

  return {
    x: clamp(
      x,
      EDGE_GAP,
      window.innerWidth - MASCOT_SIZE - EDGE_GAP
    ),
    y: clamp(
      y,
      EDGE_GAP,
      window.innerHeight - MASCOT_SIZE - EDGE_GAP
    ),
  };
}

export default function BreadyCopilot() {
  const [open, setOpen] = useState(false);

  const [position, setPosition] = useState<Position>({
    x: -1,
    y: -1,
  });

  const [dragging, setDragging] = useState(false);
  const [manuallyPlaced, setManuallyPlaced] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const positionRef = useRef(position);

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);

  const suppressClickRef = useRef(false);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    const query = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const update = () => setReducedMotion(query.matches);

    update();
    query.addEventListener("change", update);

    return () => {
      query.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    const updateBounds = () => {
      const current = positionRef.current;

      const next =
        current.x < 0
          ? boundPosition(
              window.innerWidth - MASCOT_SIZE - 20,
              window.innerHeight - MASCOT_SIZE - 116
            )
          : boundPosition(current.x, current.y);

      positionRef.current = next;
      setPosition(next);
    };

    updateBounds();

    window.addEventListener("resize", updateBounds);

    return () => {
      window.removeEventListener("resize", updateBounds);
    };
  }, []);

  useEffect(() => {
    if (
      open ||
      dragging ||
      manuallyPlaced ||
      reducedMotion
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      const current = positionRef.current;

      if (current.x < 0) return;

      const distance = window.innerWidth < 640 ? 35 : 90;

      const next = boundPosition(
        current.x + (Math.random() - 0.5) * distance,
        current.y + (Math.random() - 0.5) * distance
      );

      positionRef.current = next;
      setPosition(next);
    }, 6500);

    return () => window.clearInterval(interval);
  }, [open, dragging, manuallyPlaced, reducedMotion]);

  function handlePointerDown(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    if (event.button !== 0) return;

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: positionRef.current.x,
      originY: positionRef.current.y,
      moved: false,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;

    if (Math.hypot(dx, dy) > 6) {
      drag.moved = true;
      setDragging(true);
    }

    if (!drag.moved) return;

    const next = boundPosition(
      drag.originX + dx,
      drag.originY + dy
    );

    positionRef.current = next;
    setPosition(next);
  }

  function handlePointerUp(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (drag.moved) {
      setManuallyPlaced(true);
      suppressClickRef.current = true;
    }

    setDragging(false);

    if (
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }

    dragRef.current = null;
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    setOpen(true);
  }

  return (
    <>
      {!open && position.x >= 0 && (
        <div
          className={[
            "pointer-events-none fixed z-[60]",
            dragging
              ? ""
              : "transition-[left,top] duration-[3500ms] ease-in-out",
            reducedMotion ? "!transition-none" : "",
          ].join(" ")}
          style={{
            left: position.x,
            top: position.y,
            width: MASCOT_SIZE,
            height: MASCOT_SIZE,
          }}
        >
          <button
            type="button"
            aria-label="Buka Bready Bakery Copilot"
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="pointer-events-auto block h-full w-full cursor-grab touch-none select-none rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[#536d50] active:cursor-grabbing"
          >
            <span
              className={
                !dragging && !reducedMotion
                  ? "block h-full w-full animate-[bready-float_3s_ease-in-out_infinite]"
                  : "block h-full w-full"
              }
            >
              <BreadyMascot />
            </span>
          </button>
        </div>
      )}

      {open && (
        <BreadyChatPanel
          onClose={() => setOpen(false)}
        />
      )}

      <style jsx global>{`
        @keyframes bready-float {
          0%,
          100% {
            transform: translateY(0) rotate(-3deg);
          }

          50% {
            transform: translateY(-10px) rotate(4deg);
          }
        }
      `}</style>
    </>
  );
}