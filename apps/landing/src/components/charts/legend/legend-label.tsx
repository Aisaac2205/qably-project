"use client";

import { cn } from "@/lib/utils";
import { useLegendItem } from "./legend-context";

export interface LegendLabelProps {
  /** Label class name. Default: "text-xs font-medium" */
  className?: string;
}

export function LegendLabel({
  className = "text-xs font-medium text-foreground",
}: LegendLabelProps) {
  const { item } = useLegendItem();

  return (
    <span className={cn("text-xs font-medium text-foreground", className)}>
      {item.label}
    </span>
  );
}

LegendLabel.displayName = "LegendLabel";
