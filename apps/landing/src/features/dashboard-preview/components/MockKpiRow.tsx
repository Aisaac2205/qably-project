import React from 'react';
import { Play, ChartBar, Sparkle, Target, ArrowUp, CaretRight } from '@phosphor-icons/react';
import { MOCK_DASHBOARD_STATS } from '../data/mock-dashboard-data';
import type { DashboardTranslations } from '../../i18n/types';

interface MockKpiRowProps {
  t: DashboardTranslations;
}

export function MockKpiRow({ t }: MockKpiRowProps) {
  const stats = MOCK_DASHBOARD_STATS;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* KPI 1: Runs */}
      <div className="group rounded-xl border border-white/[0.08] bg-zinc-950 p-4 hover:border-white/20 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-400 truncate">{t.runsKpi}</span>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-zinc-300">
            <Play size={12} weight="fill" />
          </span>
        </div>
        <div className="my-2">
          <span className="text-2xl font-semibold tracking-tight text-white tabular-nums">
            {stats.runsLast7d}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px] text-zinc-500">
          <span>{t.viewDetails}</span>
          <CaretRight size={10} className="text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 2: Pass Rate */}
      <div className="group rounded-xl border border-white/[0.08] bg-zinc-950 p-4 hover:border-white/20 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-400 truncate">{t.passRateKpi}</span>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <ChartBar size={12} weight="bold" />
          </span>
        </div>
        <div className="my-2">
          <span className="text-2xl font-semibold tracking-tight text-white tabular-nums">
            {stats.passRateLast7d}%
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px]">
          <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
            <ArrowUp size={11} weight="bold" />
            +{stats.passRateTrend}%
            <span className="text-zinc-500 font-normal ml-0.5">{t.vsPrior7d}</span>
          </span>
          <CaretRight size={10} className="text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 3: AI Proposals (B&W with white/zinc accent) */}
      <div className="group rounded-xl border border-white/[0.08] bg-zinc-950 p-4 hover:border-white/20 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-400 truncate">{t.pendingAiKpi}</span>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-white">
            <Sparkle size={12} weight="fill" />
          </span>
        </div>
        <div className="my-2">
          <span className="text-2xl font-semibold tracking-tight text-white tabular-nums">
            {stats.pendingProposals}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px] text-zinc-400">
          <span>3 en revisión</span>
          <CaretRight size={10} className="text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>

      {/* KPI 4: Coverage Gaps */}
      <div className="group rounded-xl border border-white/[0.08] bg-zinc-950 p-4 hover:border-white/20 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-400 truncate">{t.coverageGapsKpi}</span>
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-white/10 bg-zinc-900 text-zinc-400">
            <Target size={12} weight="bold" />
          </span>
        </div>
        <div className="my-2">
          <span className="text-2xl font-semibold tracking-tight text-white tabular-nums">
            {stats.coverageGapsCount}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] pt-2 text-[11px] text-zinc-400">
          <span>2 requerimientos</span>
          <CaretRight size={10} className="text-zinc-600 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </div>
  );
}
