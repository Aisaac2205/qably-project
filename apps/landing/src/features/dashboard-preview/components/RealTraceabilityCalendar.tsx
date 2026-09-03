import React from 'react';

interface RealTraceabilityCalendarProps {
  isEn?: boolean;
}

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Realistic activity matrix seed: 53 weeks x 7 days
// Weeks 0-25 (Jan to Jun) are active with greens, weeks 26-52 (Jul to Dec) are gray (upcoming)
function generateHeatmapCells() {
  const cells: { week: number; day: number; level: number }[] = [];
  
  for (let w = 0; w < 52; w++) {
    for (let d = 0; d < 7; d++) {
      let level = 0;
      if (w < 26) {
        // Active months: pseudo-random patterned activity
        const pseudo = ((w * 17 + d * 31 + 7) % 100);
        if (pseudo > 80) level = 4; // Dark green
        else if (pseudo > 55) level = 3; // Medium dark green
        else if (pseudo > 30) level = 2; // Medium green
        else if (pseudo > 10) level = 1; // Light green
        else level = 0; // Empty / minimal
      } else {
        // Future months in year: gray empty cells
        level = 0;
      }
      cells.push({ week: w, day: d, level });
    }
  }
  return cells;
}

const CELLS = generateHeatmapCells();

// Exact green levels from apps/web screenshot
const LEVEL_COLORS = [
  '#f4f4f5', // Level 0: subtle zinc-100 gray
  '#bbf7d0', // Level 1: light emerald-200
  '#4ade80', // Level 2: medium emerald-400
  '#16a34a', // Level 3: dark emerald-600
  '#15803d', // Level 4: deep emerald-700
];

export function RealTraceabilityCalendar({ isEn = false }: RealTraceabilityCalendarProps) {
  const months = isEn ? MONTHS_EN : MONTHS_ES;
  const dayLabels = isEn ? ['Mon', 'Wed', 'Fri'] : ['Lun', 'Mié', 'Vie'];

  const CELL_SIZE = 10;
  const CELL_GAP = 3;
  const STEP = CELL_SIZE + CELL_GAP; // 13px
  const LEFT_OFFSET = 32;
  const TOP_OFFSET = 20;

  const svgWidth = LEFT_OFFSET + 52 * STEP + 10;
  const svgHeight = TOP_OFFSET + 7 * STEP + 6;

  return (
    <div className="w-full">
      <div className="overflow-x-auto pb-1 pt-1 scrollbar-thin">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="min-w-[660px] w-full select-none"
          role="img"
          aria-label="Calendario de trazabilidad y gobernanza"
        >
          {/* Month Labels */}
          {months.map((month, idx) => {
            const x = LEFT_OFFSET + Math.floor(idx * 4.33) * STEP;
            return (
              <text
                key={month}
                x={x}
                y={12}
                className="fill-zinc-400 text-[10px] font-sans font-medium"
              >
                {month}
              </text>
            );
          })}

          {/* Day Labels (Mon, Wed, Fri / Lun, Mié, Vie) */}
          <text x={2} y={TOP_OFFSET + 1 * STEP + 8} className="fill-zinc-400 text-[10px] font-sans font-medium">
            {dayLabels[0]}
          </text>
          <text x={2} y={TOP_OFFSET + 3 * STEP + 8} className="fill-zinc-400 text-[10px] font-sans font-medium">
            {dayLabels[1]}
          </text>
          <text x={2} y={TOP_OFFSET + 5 * STEP + 8} className="fill-zinc-400 text-[10px] font-sans font-medium">
            {dayLabels[2]}
          </text>

          {/* 52 x 7 Grid of Rounded Cells */}
          {CELLS.map((cell) => {
            const x = LEFT_OFFSET + cell.week * STEP;
            const y = TOP_OFFSET + cell.day * STEP;
            const fillColor = LEVEL_COLORS[cell.level];

            return (
              <rect
                key={`${cell.week}-${cell.day}`}
                x={x}
                y={y}
                width={CELL_SIZE}
                height={CELL_SIZE}
                rx={2.5}
                ry={2.5}
                fill={fillColor}
                className="transition-colors hover:stroke-zinc-400 hover:stroke-1 cursor-pointer"
              />
            );
          })}
        </svg>
      </div>

      {/* Footer Legend */}
      <div className="flex items-center justify-end gap-1.5 pt-3 text-[11px] text-zinc-400 font-sans">
        <span>{isEn ? 'Less' : 'Menos'}</span>
        {LEVEL_COLORS.map((color, i) => (
          <span
            key={i}
            className="size-2.5 rounded-xs"
            style={{ backgroundColor: color }}
          />
        ))}
        <span className="ml-1">{isEn ? 'More' : 'Más'}</span>
      </div>
    </div>
  );
}
