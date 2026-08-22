'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  GitBranch,
  Sparkle,
  Stack,
  Play,
  CalendarBlank,
  CaretRight,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { MOCK_NOW } from '@/lib/mock-data'
import { SelectSimple } from '@/components/ui/select'
import { useTraceabilityCalendar } from '../hooks/use-traceability-calendar'
import { TraceabilityCalendar } from './traceability-calendar'
import type { TraceabilityFilter } from '../types/traceability-calendar'

export function TraceabilitySection() {
  const { t, locale } = useTranslation()

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

  const stageOptions = [
    {
      label: t('dashboard.allStages'),
      value: 'all' as const,
      badge: totalEvents,
      icon: <CalendarBlank size={14} weight="bold" />,
    },
    {
      label: t('dashboard.stageScm'),
      value: 'scm' as const,
      badge: breakdownTotals.scm,
      icon: <GitBranch size={14} weight="bold" />,
    },
    {
      label: t('dashboard.stageProposals'),
      value: 'proposals' as const,
      badge: breakdownTotals.proposals,
      icon: <Sparkle size={14} weight="bold" />,
    },
    {
      label: t('dashboard.stageOfficial'),
      value: 'official' as const,
      badge: breakdownTotals.official,
      icon: <Stack size={14} weight="bold" />,
    },
    {
      label: t('dashboard.stageRuns'),
      value: 'runs' as const,
      badge: breakdownTotals.runs,
      icon: <Play size={14} weight="bold" />,
    },
  ] as const

  return (
    <section
      aria-labelledby="traceability-section-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-xs md:p-6"
    >
      {/* Header: Title, Inline Navigation & Pure Filter Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="traceability-section-heading"
            className="text-base font-semibold tracking-[-0.015em] text-default"
          >
            {t('dashboard.governancePipeline')}
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {t('dashboard.governanceSubtitle')}
          </p>
          <div className="mt-1.5">
            <Link
              href="/review-inbox"
              className="inline-flex items-center gap-1 text-xs font-semibold text-default transition-colors hover:text-primary"
            >
              {t('dashboard.viewChain')}
              <CaretRight size={11} weight="bold" aria-hidden="true" />
            </Link>
          </div>
        </div>

        {/* Pure Symmetrical Filter Toolbar: Exactly 2 Balanced Dropdown Selects */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Stage Filter Select with Circular Badge */}
          <SelectSimple
            options={stageOptions}
            value={activeFilter}
            onValueChange={(val) => val && setActiveFilter(val as TraceabilityFilter)}
            triggerClassName="h-9 min-w-[175px] px-3 text-xs font-medium"
          />

          {/* Year Dropdown Select */}
          <SelectSimple
            options={availableYears.map((yr) => ({
              label: `${yr}`,
              value: yr,
            }))}
            value={selectedYear}
            onValueChange={(val) => val && setSelectedYear(Number(val))}
            triggerClassName="h-9 min-w-[84px] px-3 text-xs font-semibold"
          />
        </div>
      </div>

      {/* Standalone Clean Heatmap Grid */}
      <div className="mt-4">
        <TraceabilityCalendar
          weeks={weeks}
          monthLabels={monthLabels}
          year={selectedYear}
          locale={locale === 'en' ? 'en' : 'es'}
          lessLabel={t('dashboard.less')}
          moreLabel={t('dashboard.more')}
        />
      </div>
    </section>
  )
}
