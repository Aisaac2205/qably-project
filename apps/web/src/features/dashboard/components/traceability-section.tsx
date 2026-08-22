'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  GitBranch,
  Sparkle,
  Stack,
  Play,
  CaretRight,
  CalendarBlank,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { useProjects } from '@/lib/use-mock-store'
import { MOCK_NOW } from '@/lib/mock-data'
import { SelectSimple } from '@/components/ui/select'
import { useTraceabilityCalendar } from '../hooks/use-traceability-calendar'
import { TraceabilityCalendar } from './traceability-calendar'
import type { TraceabilityFilter } from '../types/traceability-calendar'

export function TraceabilitySection() {
  const { t, locale } = useTranslation()
  const projects = useProjects()

  // Dynamically resolve target project and reference year
  const activeProjectId = projects[0]?.id ?? 'proj-1'
  const currentYear = useMemo(() => new Date(MOCK_NOW).getFullYear(), [])
  const availableYears = useMemo(() => [currentYear, currentYear - 1], [currentYear])

  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [activeFilter, setActiveFilter] = useState<TraceabilityFilter>('all')

  const { weeks, monthLabels, totalEvents, breakdownTotals } =
    useTraceabilityCalendar({
      year: selectedYear,
      activeFilter,
      locale: locale === 'en' ? 'en' : 'es',
    })

  const filterTabs = [
    {
      key: 'all' as const,
      label: t('dashboard.allStages'),
      count: totalEvents,
      icon: CalendarBlank,
      href: null,
    },
    {
      key: 'scm' as const,
      label: t('dashboard.stageScm'),
      count: breakdownTotals.scm,
      icon: GitBranch,
      href: `/projects/${activeProjectId}/repository`,
    },
    {
      key: 'proposals' as const,
      label: t('dashboard.stageProposals'),
      count: breakdownTotals.proposals,
      icon: Sparkle,
      href: '/review-inbox',
    },
    {
      key: 'official' as const,
      label: t('dashboard.stageOfficial'),
      count: breakdownTotals.official,
      icon: Stack,
      href: `/projects/${activeProjectId}/suites`,
    },
    {
      key: 'runs' as const,
      label: t('dashboard.stageRuns'),
      count: breakdownTotals.runs,
      icon: Play,
      href: `/projects/${activeProjectId}/runs`,
    },
  ] as const

  return (
    <section
      aria-labelledby="traceability-section-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-xs md:p-6"
    >
      {/* Header: Title, Total Count Badge, Year Switcher & Inbox Link */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2
              id="traceability-section-heading"
              className="text-base font-semibold tracking-[-0.015em] text-default"
            >
              {t('dashboard.governancePipeline')}
            </h2>
            <span className="inline-flex items-center rounded-md border border-border/80 bg-canvas px-2 py-0.5 text-xs font-semibold tabular-nums text-muted">
              {totalEvents.toLocaleString()} {t('dashboard.traceabilityEvents')}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {t('dashboard.governanceSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Dynamic Clean Year Dropdown Selector */}
          <SelectSimple
            options={availableYears.map((yr) => ({
              label: `${yr}`,
              value: yr,
            }))}
            value={selectedYear}
            onValueChange={(val) => val && setSelectedYear(Number(val))}
            triggerClassName="h-7 min-w-[72px] px-2 text-xs font-semibold"
          />

          <Link
            href="/review-inbox"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-default transition-colors hover:text-muted"
          >
            {t('dashboard.viewChain')}
            <CaretRight size={12} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Stage Stream Filter Bar */}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border/60 pb-3.5">
        {filterTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeFilter === tab.key

          return (
            <div key={tab.key} className="flex items-center">
              <button
                type="button"
                onClick={() => setActiveFilter(tab.key)}
                className={`group inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? 'border-border-strong bg-canvas text-default shadow-2xs'
                    : 'border-transparent bg-transparent text-muted hover:border-border/60 hover:bg-canvas/50 hover:text-default'
                }`}
              >
                <Icon
                  size={14}
                  weight={isActive ? 'bold' : 'regular'}
                  className={`shrink-0 transition-colors ${
                    isActive ? 'text-primary' : 'text-muted group-hover:text-default'
                  }`}
                  aria-hidden="true"
                />
                <span>{tab.label}</span>
                <span className="rounded-full bg-border/40 px-1.5 py-0.2 text-[10px] font-semibold tabular-nums text-muted group-hover:text-default">
                  {tab.count.toLocaleString()}
                </span>
              </button>
              {tab.href && (
                <Link
                  href={tab.href}
                  className="ml-0.5 rounded-md p-1 text-muted/60 transition-colors hover:bg-canvas hover:text-default"
                  title={`${t('dashboard.stageExplore')} ${tab.label}`}
                  aria-label={`${t('dashboard.stageExplore')} ${tab.label}`}
                >
                  <CaretRight size={10} weight="bold" />
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* Standalone Contribution Heatmap Component */}
      <div className="mt-4">
        <TraceabilityCalendar
          weeks={weeks}
          monthLabels={monthLabels}
          year={selectedYear}
          locale={locale === 'en' ? 'en' : 'es'}
          lessLabel={t('dashboard.less')}
          moreLabel={t('dashboard.more')}
          footerNote={t('dashboard.traceabilityFooter')}
        />
      </div>
    </section>
  )
}
