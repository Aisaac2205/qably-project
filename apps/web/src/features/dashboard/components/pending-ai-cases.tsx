'use client'

import Link from 'next/link'
import { Sparkle, CaretRight } from '@phosphor-icons/react'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { resolveProposalLink } from '@/features/dashboard/lib/resolve-activity-link'
import { useTranslation } from '@/lib/i18n'

const PENDING_LIMIT = 4
const HEADING_ID = 'pending-proposals-heading'

function PendingSkeletonRows() {
  return (
    <div className="divide-y divide-border/60">
      {Array.from({ length: PENDING_LIMIT }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 py-3.5 first:pt-1 last:pb-0">
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
      ))}
    </div>
  )
}

export function PendingProposals() {
  const stats = useDashboardStats()
  const { t } = useTranslation()
  const proposals = stats.recentProposals.slice(0, PENDING_LIMIT)

  return (
    <Card
      as="section"
      aria-labelledby={HEADING_ID}
      className="@container flex h-full flex-col overflow-hidden"
    >
      <CardHeader className="@md:p-6">
        <div className="flex items-center gap-2.5">
          <CardTitle as="h2" id={HEADING_ID}>
            {t('dashboard.pendingProposals')}
          </CardTitle>
          <span className="inline-flex shrink-0 items-center rounded-md border border-border bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
            {t('dashboard.pendingProposalsCount', { count: proposals.length })}
          </span>
        </div>
        <CardDescription className="mt-0.5">
          {t('dashboard.pendingProposalsSubtitle')}
        </CardDescription>
        <CardAction>
          <Link
            href="/review-inbox"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-default transition-colors hover:text-muted"
          >
            {t('dashboard.viewChain')}
            <CaretRight size={12} weight="bold" aria-hidden="true" />
          </Link>
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1 @md:p-6 @md:pt-0">
        {stats.proposalsState.isError ? (
          <StateView
            kind="error"
            title={t('dashboard.loadErrorTitle')}
            description={t('dashboard.loadErrorDescription')}
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={stats.proposalsState.retry}
              >
                {t('common.retry')}
              </Button>
            }
          />
        ) : stats.proposalsState.isLoading ? (
          <PendingSkeletonRows />
        ) : proposals.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">{t('dashboard.noPendingAi')}</p>
        ) : (
          <div className="divide-y divide-border/60">
            {proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="group flex flex-col justify-between gap-3 py-3.5 first:pt-1 last:pb-0 @sm:flex-row @sm:items-center"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-ai-bg text-ai transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Sparkle size={15} weight="fill" className="shrink-0" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-default transition-colors group-hover:text-primary">
                      {proposal.title}
                    </p>
                  </div>
                </div>

                <Link
                  href={resolveProposalLink(proposal) ?? '/review-inbox'}
                  className="inline-flex shrink-0 items-center gap-1 self-end rounded border border-border/80 bg-canvas/60 px-2.5 py-1.5 text-xs font-medium text-default transition-all duration-150 hover:border-border-strong hover:bg-surface @sm:self-center"
                >
                  {t('dashboard.reviewAction')}
                  <CaretRight size={11} weight="bold" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
