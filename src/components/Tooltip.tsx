"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";

type TooltipPlacement = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** The content shown inside the tooltip popover */
  content: React.ReactNode;
  /** The trigger element (e.g. an icon button) */
  children: React.ReactNode;
  /** Preferred placement of the tooltip relative to the trigger */
  placement?: TooltipPlacement;
  /** Additional class names for the tooltip bubble */
  className?: string;
  /** Whether the tooltip can be toggled by clicking in addition to hovering */
  clickable?: boolean;
}

/**
 * Context-aware Tooltip / Popover that:
 * - Opens on hover (and optionally click)
 * - Flips its placement when it would clip off-screen
 * - Renders with a high z-index so it never hides behind other stacking contexts
 * - Uses CSS-only fade+scale animation defined in globals.css
 */
const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  placement = "top",
  className = "",
  clickable = false,
}) => {
  const [visible, setVisible] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] =
    useState<TooltipPlacement>(placement);

  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  /** Reposition tooltip to prevent viewport clipping */
  const adjustPlacement = useCallback(() => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const trigger = triggerRef.current.getBoundingClientRect();
    const tip = tooltipRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const GAP = 12; // px gap between trigger and tooltip

    let next: TooltipPlacement = placement;

    if (placement === "top" && trigger.top - tip.height - GAP < 0) {
      next = "bottom";
    } else if (
      placement === "bottom" &&
      trigger.bottom + tip.height + GAP > vh
    ) {
      next = "top";
    } else if (placement === "left" && trigger.left - tip.width - GAP < 0) {
      next = "right";
    } else if (
      placement === "right" &&
      trigger.right + tip.width + GAP > vw
    ) {
      next = "left";
    }

    setResolvedPlacement(next);
  }, [placement]);

  useEffect(() => {
    if (visible) {
      // Run in next tick so the tooltip is mounted before measuring
      requestAnimationFrame(adjustPlacement);
    }
  }, [visible, adjustPlacement]);

  // Close on outside click
  useEffect(() => {
    if (!clickable || !visible) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [clickable, visible]);

  // ── Position styles ────────────────────────────────────────────────────────
  const positionStyles: Record<TooltipPlacement, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-3",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-3",
    left: "right-full top-1/2 -translate-y-1/2 mr-3",
    right: "left-full top-1/2 -translate-y-1/2 ml-3",
  };

  // ── Arrow styles ───────────────────────────────────────────────────────────
  const arrowBase =
    "absolute w-0 h-0 border-solid border-transparent pointer-events-none";
  const arrowStyles: Record<TooltipPlacement, string> = {
    top: `${arrowBase} top-full left-1/2 -translate-x-1/2 border-t-[6px] border-t-[#1A1A2E] border-x-[6px]`,
    bottom: `${arrowBase} bottom-full left-1/2 -translate-x-1/2 border-b-[6px] border-b-[#1A1A2E] border-x-[6px]`,
    left: `${arrowBase} left-full top-1/2 -translate-y-1/2 border-l-[6px] border-l-[#1A1A2E] border-y-[6px]`,
    right: `${arrowBase} right-full top-1/2 -translate-y-1/2 border-r-[6px] border-r-[#1A1A2E] border-y-[6px]`,
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => !clickable && setVisible(false)}
      onClick={() => clickable && setVisible((prev) => !prev)}
    >
      {children}

      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={[
            "absolute w-72 rounded-2xl bg-[#1A1A2E] px-4 py-3.5 text-white shadow-2xl",
            "animate-tooltip-in",
            "z-[9999]",
            positionStyles[resolvedPlacement],
            className,
          ].join(" ")}
        >
          {/* Arrow */}
          <span className={arrowStyles[resolvedPlacement]} />

          {content}
        </div>
      )}
    </div>
  );
};

export default Tooltip;
