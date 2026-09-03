import React from 'react';
import { Sparkle, Check, X } from '@phosphor-icons/react';
import { MOCK_AI_PROPOSALS } from '../data/mock-dashboard-data';
import type { DashboardTranslations } from '../../i18n/types';

interface MockPendingProposalsProps {
  t: DashboardTranslations;
}

export function MockPendingProposals({ t }: MockPendingProposalsProps) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-zinc-950 p-4 flex flex-col justify-between">
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="flex size-5 items-center justify-center rounded bg-white/10 text-white">
            <Sparkle size={12} weight="fill" />
          </span>
          <span className="text-xs font-semibold text-white">{t.pendingProposals}</span>
        </div>
        <span className="text-[11px] text-zinc-400 font-medium">Review Inbox</span>
      </div>

      <div className="space-y-2 my-2">
        {MOCK_AI_PROPOSALS.map((prop) => (
          <div
            key={prop.id}
            className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/[0.04] hover:border-white/10 transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-xs font-medium text-zinc-200 line-clamp-1">
                {prop.title}
              </span>
              <span className="rounded bg-white/10 border border-white/10 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-200 shrink-0">
                {prop.confidence}% conf
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-zinc-500">{prop.source}</span>
                {prop.tags.map((tag) => (
                  <span key={tag} className="rounded bg-zinc-800 px-1.5 py-0.2 text-[9px] text-zinc-400">
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Approve AI proposal"
                  className="flex size-5 items-center justify-center rounded bg-zinc-800 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 transition-colors cursor-pointer"
                >
                  <Check size={11} weight="bold" />
                </button>
                <button
                  type="button"
                  aria-label="Reject AI proposal"
                  className="flex size-5 items-center justify-center rounded bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                >
                  <X size={11} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
