import React from 'react';

interface RealTraceabilityCalendarProps {
  isEn?: boolean;
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CELL_SIZE = 10;
const CELL_GAP = 3;
const CELL_RADIUS = 2;
const STEP = CELL_SIZE + CELL_GAP;
const LEFT_OFFSET = 30;
const TOP_OFFSET = 20;
const WEEK_COUNT = 52;

const COLOR_LEVELS = [
  'var(--app-heatmap-l0)',
  'var(--app-heatmap-l1)',
  'var(--app-heatmap-l2)',
  'var(--app-heatmap-l3)',
  'var(--app-heatmap-l4)',
] as const;

function generateHeatmapCells() {
  const cells: { week: number; day: number; level: number }[] = [];

  for (let week = 0; week < WEEK_COUNT; week += 1) {
    for (let day = 0; day < 7; day += 1) {
      let level = 0;

      if (week < 26) {
        const pseudo = (week * 17 + day * 31 + 7) % 100;
        if (pseudo > 80) level = 4;
        else if (pseudo > 55) level = 3;
        else if (pseudo > 30) level = 2;
        else if (pseudo > 10) level = 1;
      }

      cells.push({ week, day, level });
    }
  }

  return cells;
}

const CELLS = generateHeatmapCells();

export function RealTraceabilityCalendar({ isEn = false }: RealTraceabilityCalendarProps) {
  const months = isEn ? MONTHS_EN : MONTHS_ES;
  const dayLabels = isEn ? ['Mon', 'Wed', 'Fri'] : ['Lun', 'Mié', 'Vie'];

  const svgWidth = LEFT_OFFSET + WEEK_COUNT * STEP + 10;
  const svgHeight = TOP_OFFSET + 7 * STEP + 4;

  return (
    <div className="relative">
      <div className="overflow-x-auto pb-1 pt-1">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[700px] select-none"
          role="img"
          aria-label="Calendario de trazabilidad y gobernanza"
        >
          {months.map((month, index) => (
            <text
              key={month}
              x={LEFT_OFFSET + Math.floor(index * 4.33) * STEP}
              y={12}
              fontSize={10}
              fill="var(--color-app-muted)"
              className="font-medium"
            >
              {month}
            </text>
          ))}

          {dayLabels.map((label, index) => (
            <text
              key={label}
              x={0}
              y={TOP_OFFSET + (index * 2 + 1) * STEP + 8}
              fontSize={9}
              fill="var(--color-app-muted)"
              className="font-medium"
            >
              {label}
            </text>
          ))}

          {CELLS.map((cell) => (
            <rect
              key={`${cell.week}-${cell.day}`}
              x={LEFT_OFFSET + cell.week * STEP}
              y={TOP_OFFSET + cell.day * STEP}
              width={CELL_SIZE}
              height={CELL_SIZE}
              rx={CELL_RADIUS}
              ry={CELL_RADIUS}
              fill={COLOR_LEVELS[cell.level]}
              className="transition-all duration-100 hover:opacity-85"
            />
          ))}
        </svg>
      </div>

      <div className="mt-3 flex flex-col gap-2 border-t border-app-border/40 pt-3 text-xs text-app-muted sm:flex-row sm:items-center sm:justify-end">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span>{isEn ? 'Less' : 'Menos'}</span>
          {COLOR_LEVELS.map((color) => (
            <span
              key={color}
              aria-hidden="true"
              className="inline-block size-2.5 rounded-[2px] border border-app-border/40"
              style={{ backgroundColor: color }}
            />
          ))}
          <span>{isEn ? 'More' : 'Más'}</span>
        </div>
      </div>
    </div>
  );
}
