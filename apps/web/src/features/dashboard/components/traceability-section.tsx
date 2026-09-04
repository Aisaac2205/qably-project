'use client'

import { useState, useMemo } from 'react'
import {
  GitBranch,
  Sparkle,
  Stack,
  Play,
  CalendarBlank,
} from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'
import { SelectSimple } from '@/components/ui/select'
import { formatEventCount } from '../lib/format'
import { useTraceabilityCalendar } from '../hooks/use-traceability-calendar'
import { TraceabilityCalendar } from './traceability-calendar'
import type { TraceabilityFilter } from '../types/traceability-calendar'

export function TraceabilitySection() {
  const { t, locale } = useTranslation()

  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const availableYears = useMemo(() => [currentYear, currentYear - 1], [currentYear])

  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [activeFilter, setActiveFilter] = useState<TraceabilityFilter>('all')

  const { weeks, monthLabels, totalEvents, breakdownTotals } =
    useTraceabilityCalendar({
      year: selectedYear,
      activeFilter,
      locale: locale === 'en' ? 'en' : 'es',
    })

  const numberLocale = locale === 'en' ? 'en' : 'es'
  const count = (value: number) => formatEventCount(value, numberLocale)

  const stageOptions = [
    {
      label: t('dashboard.allStages'),
      value: 'all' as const,
      badge: count(totalEvents),
      icon: <CalendarBlank size={14} weight="bold" />,
    },
    {
      label: t('dashboard.stageScm'),
      value: 'scm' as const,
      badge: count(breakdownTotals.scm),
      icon: <GitBranch size={14} weight="bold" />,
    },
    {
      label: t('dashboard.stageProposals'),
      value: 'proposals' as const,
      badge: count(breakdownTotals.proposals),
      icon: <Sparkle size={14} weight="bold" />,
    },
    {
      label: t('dashboard.stageOfficial'),
      value: 'official' as const,
      badge: count(breakdownTotals.official),
      icon: <Stack size={14} weight="bold" />,
    },
    {
      label: t('dashboard.stageRuns'),
      value: 'runs' as const,
      badge: count(breakdownTotals.runs),
      icon: <Play size={14} weight="bold" />,
    },
  ] as const

  return (
    <section
      aria-labelledby="traceability-section-heading"
      className="rounded-xl border border-border bg-surface p-5 shadow-xs md:p-6"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2
          id="traceability-section-heading"
          className="text-base font-semibold tracking-[-0.015em] text-default"
        >
          {t('dashboard.traceabilityHeading', {
            count: count(totalEvents),
            year: selectedYear,
          })}
        </h2>

        <div className="flex flex-wrap items-center gap-2.5">
          <SelectSimple
            options={stageOptions}
            value={activeFilter}
            onValueChange={(val) => val && setActiveFilter(val as TraceabilityFilter)}
            triggerClassName="h-9 min-w-[175px] px-3 text-xs font-medium"
            badgeInTrigger={false}
          />

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
