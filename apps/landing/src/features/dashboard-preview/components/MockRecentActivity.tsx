import React from 'react';
import { Clock, CheckCircle, XCircle } from '@phosphor-icons/react';
import { MOCK_RECENT_RUNS } from '../data/mock-dashboard-data';
import type { DashboardTranslations } from '../../i18n/types';

interface MockRecentActivityProps {
  t: DashboardTranslations;
}

export function MockRecentActivity({ t }: MockRecentActivityProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950 p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{t.recentActivity}</span>
          <span className="flex size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <span className="text-[11px] text-zinc-500">CI/CD Webhook Live</span>
      </div>

      <div className="space-y-2 my-2">
        {MOCK_RECENT_RUNS.map((run) => (
          <div
            key={run.id}
            className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-900/40 border border-white/[0.04] hover:border-white/10 transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {run.status === 'pass' ? (
                <CheckCircle size={15} weight="fill" className="text-emerald-400 shrink-0" />
              ) : (
                <XCircle size={15} weight="fill" className="text-rose-500 shrink-0" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-zinc-200 truncate">{run.title}</span>
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    {run.duration}
                  </span>
                  <span>•</span>
                  <span>{run.testCount} tests</span>
                </div>
              </div>
            </div>

            <span className="text-[11px] text-zinc-500 whitespace-nowrap shrink-0">
              {run.timeAgo}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
