"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useChart } from "./chart-context";

export interface BarXAxisProps {
  /** Maximum number of tick labels to display to prevent crowding. Default: 8 */
  maxLabels?: number;
  /** Additional CSS class */
  className?: string;
}

export const BarXAxis = memo(function BarXAxis({
  maxLabels = 8,
  className = "",
}: BarXAxisProps) {
  const { data, barScale, barXAccessor, height, margin } = useChart();

  if (!barScale || !barXAccessor || data.length === 0) {
    return null;
  }

  const bandWidth = barScale.bandwidth();
  const y = height - margin.bottom + 18;

  // Evenly sample indices so at most maxLabels labels appear
  const step = Math.max(1, Math.ceil(data.length / maxLabels));
  const tickIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < data.length; i += step) {
      indices.push(i);
    }
    // Ensure the last item is included if not too close to the previous
    const lastIdx = data.length - 1;
    if (indices[indices.length - 1] !== lastIdx && lastIdx - indices[indices.length - 1] >= step / 2) {
      indices.push(lastIdx);
    }
    return indices;
  }, [data.length, step]);

  return (
    <g className={cn("chart-bar-x-axis", className)} aria-hidden="true">
      {tickIndices.map((index) => {
        const d = data[index];
        const label = barXAccessor(d);
        const x = barScale(label);
        if (x === undefined) return null;

        return (
          <text
            key={`${label}-${index}`}
            className="fill-muted text-[11px] font-medium select-none pointer-events-none"
            textAnchor="middle"
            x={x + bandWidth / 2}
            y={y}
          >
            {label}
          </text>
        );
      })}
    </g>
  );
});
