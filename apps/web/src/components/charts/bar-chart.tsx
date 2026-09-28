"use client";

import { ParentSize } from "@visx/responsive";
import { scaleBand, scaleLinear, scaleTime } from "@visx/scale";
import {
  Children,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import {
  isClipExcludedComponent,
  isPostOverlayComponent,
  isUnderlayComponent,
} from "./chart-child-passthrough";
import {
  ChartProvider,
  type LineConfig,
  type Margin,
  type TooltipData,
} from "./chart-context";
import { DEFAULT_CHART_LIFECYCLE } from "./chart-phase";
import { wrapSingleYScale } from "./y-axis-scales";

export interface BarChartProps {
  /** Data array */
  data: Record<string, unknown>[];
  /** Key in data for the x-axis category. Default: "day" */
  xDataKey?: string;
  /** Gap ratio between bars (0 to 1). Default: 0.1 */
  barGap?: number;
  /** Chart margins */
  margin?: Partial<Margin>;
  /** Aspect ratio as "width / height". Default: "4 / 1" */
  aspectRatio?: string;
  /** Optional inline container styles (e.g. fixed height) */
  style?: React.CSSProperties;
  /** Additional container class name */
  className?: string;
  /** Child components (Grid, Bar, BarXAxis, ChartTooltip, etc.) */
  children: ReactNode;
}

const DEFAULT_MARGIN: Margin = { top: 8, right: 8, bottom: 40, left: 8 };

export function BarChart(props: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { aspectRatio = "4 / 1", style, className = "" } = props;

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full", className)}
      style={{
        aspectRatio: style?.height ? undefined : aspectRatio,
        touchAction: "none",
        ...style,
      }}
    >
      <ParentSize debounceTime={10}>
        {({ width, height }) => (
          <BarChartWithDimensions
            {...props}
            containerRef={containerRef}
            height={height}
            width={width}
          />
        )}
      </ParentSize>
    </div>
  );
}

interface BarChartInnerProps extends BarChartProps {
  width: number;
  height: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

function BarChartWithDimensions(props: BarChartInnerProps) {
  const { width, height } = props;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return <BarChartCore {...props} />;
}

const BarChartCore = memo(function BarChartCore({
  width,
  height,
  data,
  xDataKey = "day",
  barGap = 0.1,
  margin: marginProp,
  children,
  containerRef,
}: BarChartInnerProps) {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);

  const margin: Margin = useMemo(
    () => ({ ...DEFAULT_MARGIN, ...marginProp }),
    [marginProp]
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const barXAccessor = useCallback(
    (d: Record<string, unknown>): string => {
      const val = d[xDataKey];
      if (val === null || val === undefined) return "";
      return String(val);
    },
    [xDataKey]
  );

  const barScale = useMemo(() => {
    return scaleBand<string>({
      domain: data.map(barXAccessor),
      range: [margin.left, width - margin.right],
      padding: barGap,
    });
  }, [data, barXAccessor, margin.left, width, margin.right, barGap]);

  // Extract bar data keys to compute max value
  const barDataKeys = useMemo(() => {
    const keys: string[] = [];
    Children.forEach(children, (child) => {
      if (isValidElement(child) && (child.props as { dataKey?: string })?.dataKey) {
        keys.push((child.props as { dataKey: string }).dataKey);
      }
    });
    return keys.length > 0 ? keys : ["value"];
  }, [children]);

  const maxVal = useMemo(() => {
    let max = 0;
    for (const d of data) {
      for (const k of barDataKeys) {
        const v = Number(d[k] ?? 0);
        if (v > max) max = v;
      }
    }
    return max > 0 ? max : 10;
  }, [data, barDataKeys]);

  const yScale = useMemo(() => {
    return scaleLinear<number>({
      domain: [0, maxVal * 1.15],
      range: [height - margin.bottom, margin.top],
      nice: true,
    });
  }, [maxVal, height, margin.bottom, margin.top]);

  // Dummy xScale for components that query xScale
  const dummyXScale = useMemo(() => {
    return scaleTime({
      domain: [new Date(), new Date()],
      range: [margin.left, width - margin.right],
    });
  }, [margin.left, width, margin.right]);

  const lines = useMemo<LineConfig[]>(() => {
    return barDataKeys.map((key) => ({
      dataKey: key,
      color: "var(--chart-1)",
      label: key,
      stroke: "var(--chart-1)",
      strokeWidth: 0,
    }));
  }, [barDataKeys]);

  const isDefsComponent = (child: ReactElement): boolean => {
    const displayName =
      (child.type as { displayName?: string })?.displayName ||
      (child.type as { name?: string })?.name ||
      "";
    return (
      displayName.includes("Gradient") ||
      displayName.includes("Pattern") ||
      displayName === "LinearGradient" ||
      displayName === "RadialGradient"
    );
  };

  const defsChildren: ReactElement[] = [];
  const clipExcludedChildren: ReactElement[] = [];
  const underlayChildren: ReactElement[] = [];
  const mainChildren: ReactElement[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "defs") {
      Children.forEach((child.props as { children?: ReactNode }).children, (defChild) => {
        if (isValidElement(defChild)) defsChildren.push(defChild);
      });
    } else if (isDefsComponent(child)) {
      defsChildren.push(child);
    } else if (isClipExcludedComponent(child)) {
      clipExcludedChildren.push(child);
    } else if (isUnderlayComponent(child)) {
      underlayChildren.push(child);
    } else {
      mainChildren.push(child);
    }
  });

  const chartContextValue = useMemo(
    () => ({
      data,
      renderData: data,
      xScale: dummyXScale,
      yScale,
      yScales: wrapSingleYScale(yScale),
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      columnWidth: barScale.bandwidth(),
      containerRef,
      lines,
      referenceAreas: [],
      ...DEFAULT_CHART_LIFECYCLE,
      isLoaded: true,
      animationDuration: 500,
      xAccessor: () => new Date(),
      dateLabels: data.map(barXAccessor),
      tooltipData,
      setTooltipData,
      hoveredBarIndex,
      setHoveredBarIndex,
      barScale,
      bandWidth: barScale.bandwidth(),
      barXAccessor,
      orientation: "vertical" as const,
    }),
    [
      data,
      dummyXScale,
      yScale,
      width,
      height,
      innerWidth,
      innerHeight,
      margin,
      barScale,
      containerRef,
      lines,
      barXAccessor,
      tooltipData,
      hoveredBarIndex,
    ]
  );

  return (
    <ChartProvider value={chartContextValue}>
      <svg
        aria-hidden="true"
        className="block size-full"
        height={height}
        width={width}
        onMouseLeave={() => {
          setHoveredBarIndex(null);
          setTooltipData(null);
        }}
      >
        {defsChildren.length > 0 && <defs>{defsChildren}</defs>}
        {underlayChildren}
        {clipExcludedChildren}
        {mainChildren}
      </svg>
    </ChartProvider>
  );
});
