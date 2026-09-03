import React from 'react';
import { ArrowUp, CaretDown } from '@phosphor-icons/react';
import { MOCK_TREND_DATA } from '../data/mock-dashboard-data';
import type { DashboardTranslations } from '../../i18n/types';

interface MockPassRateTrendProps {
  t: DashboardTranslations;
}

const CHART_WIDTH = 480;
const CHART_HEIGHT = 140;
const PLOT_LEFT = 24;
const PLOT_RIGHT = 460;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 115;

function xPosition(index: number) {
  return PLOT_LEFT + (index / (MOCK_TREND_DATA.length - 1)) * (PLOT_RIGHT - PLOT_LEFT);
}

function yPosition(rate: number) {
  return PLOT_TOP + ((100 - rate) / 30) * (PLOT_BOTTOM - PLOT_TOP);
}

export function MockPassRateTrend({ t }: MockPassRateTrendProps) {
  const linePath = MOCK_TREND_DATA.map((item, index) => {
    const command = index === 0 ? 'M' : 'L';
    return `${command} ${xPosition(index)} ${yPosition(item.rate)}`;
  }).join(' ');

  const areaPath = `${linePath} L ${xPosition(MOCK_TREND_DATA.length - 1)} ${PLOT_BOTTOM} L ${PLOT_LEFT} ${PLOT_BOTTOM} Z`;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950 p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{t.passRateTrend}</span>
          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <ArrowUp size={10} weight="bold" />
            +5%
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-zinc-400 bg-zinc-900 border border-white/10 px-2 py-0.5 rounded-md">
          <span>7 días</span>
          <CaretDown size={9} />
        </div>
      </div>

      <div className="my-2">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-semibold tracking-tight text-white tabular-nums">
            89.4%
          </span>
          <span className="text-xs text-zinc-400">promedio ponderado</span>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full h-28 overflow-visible"
          >
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            <line x1={PLOT_LEFT} y1={yPosition(90)} x2={PLOT_RIGHT} y2={yPosition(90)} stroke="#27272a" strokeDasharray="3 3" />
            <line x1={PLOT_LEFT} y1={yPosition(80)} x2={PLOT_RIGHT} y2={yPosition(80)} stroke="#27272a" strokeDasharray="3 3" />

            <path d={areaPath} fill="url(#trendGradient)" />
            <path d={linePath} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

            {MOCK_TREND_DATA.map((item, index) => (
              <g key={item.day}>
                <circle
                  cx={xPosition(index)}
                  cy={yPosition(item.rate)}
                  r={index === MOCK_TREND_DATA.length - 1 ? 4 : 2.5}
                  className={index === MOCK_TREND_DATA.length - 1 ? "fill-emerald-400 stroke-zinc-950 stroke-2" : "fill-emerald-500/70"}
                />
              </g>
            ))}
          </svg>
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-zinc-500 pt-1 border-t border-white/[0.04]">
        <span>Hace 7 días</span>
        <span>Hoy</span>
      </div>
    </div>
  );
}
