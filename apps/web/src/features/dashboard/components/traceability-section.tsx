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
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { formatEventCount } from '../lib/format'
import { useTraceabilityCalendar } from '../hooks/use-traceability-calendar'
import { TraceabilityCalendar } from './traceability-calendar'
import { describeDay } from './traceability-tooltip'
import type { TraceabilityFilter } from '../types/traceability-calendar'

function TraceabilityCalendarSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-4 w-40 rounded" />
      <Skeleton className="h-28 w-full rounded-lg" />
    </div>
  )
}

export function TraceabilitySection({ projectId }: { projectId?: string } = {}) {
  const { t, locale } = useTranslation()

  const currentYear = useMemo(() => new Date().getFullYear(), [])
  const availableYears = useMemo(() => [currentYear, currentYear - 1], [currentYear])

  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [activeFilter, setActiveFilter] = useState<TraceabilityFilter>('all')

  const { weeks, monthLabels, totalEvents, breakdownTotals, isLoading, isError, retry } =
    useTraceabilityCalendar({
      year: selectedYear,
      activeFilter,
      locale: locale === 'en' ? 'en' : 'es',
      projectId,
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
    <Card
      as="section"
      aria-labelledby="traceability-section-heading"
      className="@container overflow-hidden"
    >
      <div className="flex flex-col gap-3 border-b border-border bg-canvas px-4 py-3.5 @md:flex-row @md:items-center @md:justify-between @md:px-5">
        <h2
          id="traceability-section-heading"
          className="text-base font-semibold tracking-[-0.015em] text-default"
        >
          {t('dashboard.traceabilityHeading', {
            count: count(totalEvents),
            year: selectedYear,
          })}
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <SelectSimple
            options={stageOptions}
            value={activeFilter}
            onValueChange={(val) => val && setActiveFilter(val as TraceabilityFilter)}
            triggerClassName="h-8 min-w-[168px] px-2.5 text-xs font-medium"
            badgeInTrigger={false}
          />

          <SelectSimple
            options={availableYears.map((yr) => ({
              label: `${yr}`,
              value: yr,
            }))}
            value={selectedYear}
            onValueChange={(val) => val && setSelectedYear(Number(val))}
            triggerClassName="h-8 min-w-[80px] px-2.5 text-xs font-semibold"
          />
        </div>
      </div>

      <div className="px-4 pt-4 pb-3 @md:px-5">
        {isError ? (
          <StateView
            kind="error"
            title={t('dashboard.loadErrorTitle')}
            description={t('dashboard.loadErrorDescription')}
            action={
              <Button type="button" variant="outline" size="sm" onClick={retry}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : isLoading ? (
          <TraceabilityCalendarSkeleton />
        ) : (
          <TraceabilityCalendar
            weeks={weeks}
            monthLabels={monthLabels}
            locale={locale === 'en' ? 'en' : 'es'}
            caption={t('dashboard.traceabilityCalendarLabel', { year: selectedYear })}
            dayLabel={(day) => describeDay(t, day)}
            lessLabel={t('dashboard.less')}
            moreLabel={t('dashboard.more')}
          />
        )}
      </div>
    </Card>
  )
}
