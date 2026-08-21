'use client'

import Link from 'next/link'
import { Sparkle, CaretRight } from '@phosphor-icons/react'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'

export function PendingProposals() {
  const stats = useDashboardStats()
  const { t } = useTranslation()
  const proposals = stats.recentProposals.slice(0, 4)

  return (
    <section
      aria-labelledby="pending-proposals-heading"
      className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 shadow-xs md:p-6"
    >
      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2
                id="pending-proposals-heading"
                className="text-base font-semibold tracking-[-0.015em] text-default"
              >
                {t('dashboard.pendingProposals')}
              </h2>
              <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
                {t('dashboard.pendingProposalsCount', { count: proposals.length })}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {t('dashboard.pendingProposalsSubtitle')}
            </p>
          </div>

          <Link
            href="/review-inbox"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-default transition-colors hover:text-muted"
          >
            {t('dashboard.viewChain')}
            <CaretRight size={12} weight="bold" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-4 divide-y divide-border/60">
          {proposals.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">{t('dashboard.noPendingAi')}</p>
          ) : (
            proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="group flex flex-col justify-between gap-3 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-ai-bg text-ai transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Sparkle size={15} weight="fill" className="shrink-0" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-default group-hover:text-primary transition-colors">
                      {proposal.title}
                    </p>
                  </div>
                </div>

                <Link
                  href="/review-inbox"
                  className="inline-flex shrink-0 items-center gap-1 self-end rounded border border-border/80 bg-canvas/60 px-2.5 py-1.5 text-xs font-medium text-default transition-all duration-150 hover:border-border-strong hover:bg-surface sm:self-center"
                >
                  {t('dashboard.reviewAction')}
                  <CaretRight size={11} weight="bold" aria-hidden="true" />
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}
