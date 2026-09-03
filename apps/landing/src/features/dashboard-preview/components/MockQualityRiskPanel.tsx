import React from 'react';
import { WarningCircle, ShieldWarning, Crosshair } from '@phosphor-icons/react';
import { MOCK_QUALITY_RISKS } from '../data/mock-dashboard-data';
import type { DashboardTranslations } from '../../i18n/types';

interface MockQualityRiskPanelProps {
  t: DashboardTranslations;
}

export function MockQualityRiskPanel({ t }: MockQualityRiskPanelProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950 p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <ShieldWarning size={14} className="text-amber-400" weight="fill" />
          <span className="text-xs font-semibold text-white">{t.qualityRisks}</span>
        </div>
        <span className="text-[11px] text-zinc-500">Motor Heurístico</span>
      </div>

      <div className="space-y-2 my-2">
        {MOCK_QUALITY_RISKS.map((risk) => (
          <div
            key={risk.id}
            className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-zinc-900/40 border border-white/[0.04]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {risk.type === 'flaky' ? (
                <WarningCircle size={15} weight="fill" className="text-amber-400 shrink-0" />
              ) : risk.type === 'high_risk' ? (
                <ShieldWarning size={15} weight="fill" className="text-rose-400 shrink-0" />
              ) : (
                <Crosshair size={15} weight="bold" className="text-blue-400 shrink-0" />
              )}
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-zinc-200 truncate">{risk.name}</span>
                <span className="text-[11px] text-zinc-400">{risk.metric}</span>
              </div>
            </div>

            <span
              className={`text-[10px] font-medium px-2 py-0.5 rounded shrink-0 ${
                risk.severity === 'critical'
                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                  : risk.severity === 'high'
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                    : 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
              }`}
            >
              {risk.severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
