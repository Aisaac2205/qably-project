import React from 'react';
import { MOCK_PROJECTS } from '../data/mock-dashboard-data';
import type { DashboardTranslations } from '../../i18n/types';

interface MockProjectHealthTableProps {
  t: DashboardTranslations;
}

export function MockProjectHealthTable({ t }: MockProjectHealthTableProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950 p-4 flex flex-col justify-between overflow-hidden">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{t.projectHealth}</span>
          <span className="rounded-full bg-zinc-900 border border-white/10 px-2 py-0.5 text-[10px] text-zinc-400">
            {MOCK_PROJECTS.length} activos
          </span>
        </div>
        <span className="text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer">
          {t.viewAll} →
        </span>
      </div>

      <div className="overflow-x-auto my-2">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/[0.04] text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
              <th className="py-2 pr-3">{t.thProject}</th>
              <th className="py-2 px-2">{t.thHealth}</th>
              <th className="py-2 px-2">{t.thLastRun}</th>
              <th className="py-2 px-2 text-center">{t.thSuites}</th>
              <th className="py-2 pl-2 text-right">{t.thAiPending}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {MOCK_PROJECTS.map((proj) => (
              <tr key={proj.id} className="hover:bg-zinc-900/40 transition-colors group">
                <td className="py-2.5 pr-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-white group-hover:text-zinc-200 transition-colors">
                      {proj.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 truncate max-w-[140px]">
                      {proj.technologies.join(' • ')}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`inline-block size-1.5 rounded-full ${
                        proj.lastRunStatus === 'pass'
                          ? 'bg-emerald-400'
                          : proj.lastRunStatus === 'fail'
                            ? 'bg-rose-500'
                            : 'bg-blue-400 animate-pulse'
                      }`}
                    />
                    <span className="text-xs font-semibold tabular-nums text-zinc-200">
                      {proj.healthScore}%
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-2 text-zinc-400 text-[11px] whitespace-nowrap">
                  {proj.lastRunAt}
                </td>
                <td className="py-2.5 px-2 text-center text-zinc-300 text-[11px] tabular-nums">
                  {proj.suiteCount}
                </td>
                <td className="py-2.5 pl-2 text-right">
                  {proj.aiPendingCount > 0 ? (
                    <span className="inline-flex items-center justify-center rounded bg-white/10 border border-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-white">
                      +{proj.aiPendingCount}
                    </span>
                  ) : (
                    <span className="text-zinc-600 text-[11px]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
