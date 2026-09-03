import React from 'react';
import { CheckCircle, XCircle, Clock } from '@phosphor-icons/react';
import { MOCK_TRACEABILITY_ITEMS } from '../data/mock-dashboard-data';
import type { DashboardTranslations } from '../../i18n/types';

interface MockTraceabilitySectionProps {
  t: DashboardTranslations;
}

export function MockTraceabilitySection({ t }: MockTraceabilitySectionProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950 p-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{t.traceabilityMatrix}</span>
          <span className="text-[11px] text-zinc-500">100% Requisitos Enlazados</span>
        </div>
        <span className="text-xs text-zinc-400 hover:text-white font-medium cursor-pointer transition-colors">
          Abrir grafo →
        </span>
      </div>

      <div className="space-y-2">
        {MOCK_TRACEABILITY_ITEMS.map((item) => (
          <div
            key={item.req}
            className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/40 border border-white/[0.04] hover:border-white/10 transition-colors text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {item.status === 'pass' ? (
                <CheckCircle size={15} weight="fill" className="text-emerald-400 shrink-0" />
              ) : item.status === 'fail' ? (
                <XCircle size={15} weight="fill" className="text-rose-500 shrink-0" />
              ) : (
                <Clock size={15} weight="fill" className="text-blue-400 shrink-0" />
              )}
              <span className="text-zinc-200 font-medium truncate">{item.req}</span>
            </div>

            <div className="flex items-center gap-4 shrink-0 text-[11px]">
              <span className="text-zinc-400">{item.tests} tests</span>
              <span
                className={`font-semibold ${
                  item.coverage === '100%'
                    ? 'text-emerald-400'
                    : parseInt(item.coverage) >= 80
                      ? 'text-blue-400'
                      : 'text-amber-400'
                }`}
              >
                {item.coverage}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
