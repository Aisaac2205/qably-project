"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { useChart } from "./chart-context";
import { computeSeriesBarWidth } from "./series-bar-layout";

export interface StackedBarSegment {
  /** Property key in each data item holding this segment's value */
  dataKey: string;
  /** Fill color or CSS variable */
  fill: string;
}

export interface StackedBarProps {
  /**
   * Property key in each data item holding the stack's combined total —
   * drives the shared y-domain the same way a single-series `Bar`'s
   * `dataKey` does. Callers precompute this as the sum of every segment.
   */
  dataKey: string;
  /** Segments stacked bottom-to-top in array order */
  segments: readonly StackedBarSegment[];
  /** Corner radius in px applied to the topmost non-empty segment. Default: 4 */
  radius?: number;
  /** Additional CSS class */
  className?: string;
}

export const StackedBar = memo(function StackedBar({
  segments,
  radius = 4,
  className = "",
}: StackedBarProps) {
  const {
    data,
    barScale,
    yScale,
    barXAccessor,
    innerWidth,
    columnWidth,
    hoveredBarIndex,
    setHoveredBarIndex,
    setTooltipData,
  } = useChart();

  if (!barScale || !barXAccessor || data.length === 0) {
    return null;
  }

  const barWidth = computeSeriesBarWidth({
    innerWidth,
    dataLength: data.length,
    columnWidth,
    seriesCount: segments.length,
    stacked: true,
  });

  return (
    <g className={cn("chart-bars", className)}>
      {data.map((d, index) => {
        const xKey = barXAccessor(d);
        const bandX = barScale(xKey);
        if (bandX === undefined) return null;

        const barX = bandX + (barScale.bandwidth() - barWidth) / 2;
        const isHovered = hoveredBarIndex === index;

        let cumulative = 0;
        const yPositions: Record<string, number> = {};
        let lastNonZeroIndex = -1;

        segments.forEach((segment, segIndex) => {
          if (Number(d[segment.dataKey] ?? 0) > 0) lastNonZeroIndex = segIndex;
        });

        const rects = segments.map((segment, segIndex) => {
          const value = Number(d[segment.dataKey] ?? 0);
          const segTop = yScale(cumulative + value);
          const segBottom = yScale(cumulative);
          const segHeight = Math.max(0, segBottom - segTop);
          yPositions[segment.dataKey] = segTop;
          cumulative += value;

          const isTopSegment = segIndex === lastNonZeroIndex;
          const cornerRadius = isTopSegment ? Math.min(radius, segHeight / 2) : 0;

          return (
            <rect
              key={segment.dataKey}
              fill={segment.fill}
              height={segHeight}
              rx={cornerRadius}
              ry={cornerRadius}
              width={barWidth}
              x={barX}
              y={segTop}
            />
          );
        });

        return (
          <g
            className="cursor-pointer transition-opacity duration-150"
            key={`${xKey}-${index}`}
            opacity={hoveredBarIndex === null || isHovered ? 1 : 0.4}
            onMouseEnter={() => {
              setHoveredBarIndex?.(index);
              setTooltipData?.({
                point: d,
                x: barX + barWidth / 2,
                yPositions,
                index,
              });
            }}
          >
            {rects}
          </g>
        );
      })}
    </g>
  );
});
