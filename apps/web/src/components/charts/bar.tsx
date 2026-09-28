"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useChart } from "./chart-context";

export interface BarProps {
  /** Property key in data items representing the bar value */
  dataKey: string;
  /** Fill color or CSS variable. Default: var(--color-primary, #0ea5e9) */
  fill?: string;
  /** Line cap / top corner style. Default: "butt" */
  lineCap?: "butt" | "round" | "square";
  /** Corner radius in px for rounded bars. Default: 3 */
  radius?: number;
  /** Additional CSS class */
  className?: string;
}

export const Bar = memo(function Bar({
  dataKey,
  fill = "var(--color-primary, #0ea5e9)",
  lineCap = "butt",
  radius = 3,
  className = "",
}: BarProps) {
  const {
    data,
    barScale,
    yScale,
    barXAccessor,
    height,
    margin,
    hoveredBarIndex,
    setHoveredBarIndex,
    setTooltipData,
  } = useChart();

  if (!barScale || !barXAccessor || data.length === 0) {
    return null;
  }

  const bandWidth = barScale.bandwidth();
  const cornerRadius = lineCap === "round" ? Math.min(radius, bandWidth / 2) : 0;

  return (
    <g className={cn("chart-bars", className)}>
      {data.map((d, index) => {
        const xKey = barXAccessor(d);
        const x = barScale(xKey);
        if (x === undefined) return null;

        const val = Number(d[dataKey] ?? 0);
        const y = yScale(val);
        const barHeight = Math.max(0, height - margin.bottom - y);
        const isHovered = hoveredBarIndex === index;

        return (
          <rect
            key={`${xKey}-${index}`}
            className="transition-opacity duration-150 cursor-pointer"
            fill={fill}
            height={barHeight}
            opacity={hoveredBarIndex === null || isHovered ? 1 : 0.4}
            rx={cornerRadius}
            ry={cornerRadius}
            width={bandWidth}
            x={x}
            y={y}
            onMouseEnter={() => {
              setHoveredBarIndex?.(index);
              setTooltipData?.({
                point: d,
                x: x + bandWidth / 2,
                yPositions: { [dataKey]: y },
                index,
              });
            }}
          />
        );
      })}
    </g>
  );
});
