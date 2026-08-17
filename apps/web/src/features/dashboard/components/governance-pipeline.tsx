'use client'

import Link from 'next/link'
import {
  GitBranch,
  Sparkle,
  Stack,
  Play,
  CaretRight,
  ShieldCheck,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import {
  useIngestionBatches,
  useProposals,
  useSuites,
  useRuns,
} from '@/lib/use-mock-store'

export function GovernancePipeline() {
  const { t } = useTranslation()
  const batches = useIngestionBatches()
  const proposals = useProposals()
  const suites = useSuites()
  const runs = useRuns()

  const pendingProposals = proposals.filter((p) => p.status === 'in_review').length
  const totalCases = suites.reduce((acc, s) => acc + (s.cases?.length ?? 0), 0)
  const recentRunsCount = runs.length
  const activeBatchesCount = batches.length

  const stages = [
    {
      step: '01',
      title: t('dashboard.stageScm'),
      desc: t('dashboard.stageScmDesc'),
      count: t('dashboard.stageScmCount', { count: activeBatchesCount }),
      icon: GitBranch,
      href: '/projects/proj-1/repository',
    },
    {
      step: '02',
      title: t('dashboard.stageProposals'),
      desc: t('dashboard.stageProposalsDesc'),
      count: t('dashboard.stageProposalsCount', { count: pendingProposals }),
      icon: Sparkle,
      href: '/review-inbox',
    },
    {
      step: '03',
      title: t('dashboard.stageOfficial'),
      desc: t('dashboard.stageOfficialDesc'),
      count: t('dashboard.stageOfficialCount', { count: totalCases }),
      icon: Stack,
      href: '/projects/proj-1/suites',
    },
    {
      step: '04',
      title: t('dashboard.stageRuns'),
      desc: t('dashboard.stageRunsDesc'),
      count: t('dashboard.stageRunsCount', { count: recentRunsCount }),
      icon: Play,
      href: '/projects/proj-1/runs',
    },
  ]

  return (
    <section
      aria-labelledby="governance-pipeline-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-xs md:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="governance-pipeline-heading"
            className="text-base font-semibold tracking-[-0.015em] text-default"
          >
            {t('dashboard.governancePipeline')}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {t('dashboard.governanceSubtitle')}
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

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage) => {
          const Icon = stage.icon
          return (
            <Link
              key={stage.step}
              href={stage.href}
              className="group relative flex flex-col justify-between rounded-lg border border-border/80 bg-canvas/40 p-4 transition-all duration-150 hover:border-border-strong hover:bg-surface"
            >
              <div>
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="text-xs font-semibold text-muted">
                    {stage.step}
                  </span>
                  <Icon
                    size={16}
                    weight="regular"
                    aria-hidden="true"
                    className="text-muted transition-colors group-hover:text-default"
                  />
                </div>
                <p className="mt-2 text-sm font-semibold tracking-[-0.01em] text-default group-hover:underline">
                  {stage.title}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {stage.desc}
                </p>
              </div>

              <div className="mt-3.5 flex items-center justify-between border-t border-border/40 pt-2.5 text-xs">
                <span className="text-xs font-semibold tabular-nums text-default">
                  {stage.count}
                </span>
                <span className="inline-flex items-center gap-0.5 text-xs text-muted transition-colors group-hover:text-default">
                  {t('dashboard.stageExplore')} <CaretRight size={11} weight="bold" aria-hidden="true" />
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <ShieldCheck size={14} weight="regular" aria-hidden="true" className="text-default" />
          {t('dashboard.governanceHumanAuthority')}
        </span>
        <span className="text-xs text-muted">{t('dashboard.governanceTraceability')}</span>
      </div>
    </section>
  )
}
