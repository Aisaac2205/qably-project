"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLegend, useLegendItem } from "./legend-context";

export interface LegendItemProps {
  /** Container class name */
  className?: string;
  /** Children components (LegendMarker, LegendLabel, LegendValue, LegendProgress) */
  children: ReactNode;
}

export function LegendItem({ className = "", children }: LegendItemProps) {
  const { setHoveredIndex } = useLegend();
  const { index, isHovered, isFaded } = useLegendItem();

  return (
    <div
      className={cn(
        "cursor-pointer inline-flex items-center gap-1.5 transition-opacity duration-150 ease-out select-none",
        isFaded && "opacity-30",
        className
      )}
      data-hovered={isHovered ? "" : undefined}
      onMouseEnter={() => setHoveredIndex(index)}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      {children}
    </div>
  );
}

LegendItem.displayName = "LegendItem";

export const LegendItemComponent = LegendItem;
