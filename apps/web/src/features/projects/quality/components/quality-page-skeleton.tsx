'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'

const SHELL_CLASSES =
  'w-full space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter'
const KPI_CARD_COUNT = 5
const REGRESSION_ROW_COUNT = 3
const SUITE_ROW_COUNT = 3

export function QualityPageSkeleton() {
  const { t } = useTranslation()

  return (
    <div className={SHELL_CLASSES} aria-busy="true">
      <span role="status" className="sr-only">
        {t('quality.loading')}
      </span>

      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-56" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: KPI_CARD_COUNT }, (_, index) => (
          <div
            key={index}
            className="flex min-h-[120px] flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="size-7 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
        <Skeleton className="mb-3 h-4 w-56" />
        <Skeleton className="h-[120px] w-full" />
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-card">
          {Array.from({ length: REGRESSION_ROW_COUNT }, (_, index) => (
            <div key={index} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-3 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="rounded-xl border border-border bg-surface shadow-card">
          <div className="flex items-center gap-6 border-b border-border px-4 py-2.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="ml-auto h-3 w-12" />
          </div>
          {Array.from({ length: SUITE_ROW_COUNT }, (_, index) => (
            <div
              key={index}
              className="flex items-center gap-6 border-b border-border px-4 py-3 last:border-b-0"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-5 w-16 rounded" />
              <Skeleton className="ml-auto h-3.5 w-10" />
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-canvas px-4 py-3.5 sm:px-5">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-8 w-40 rounded-lg" />
        </div>
        <Skeleton className="m-4 h-24 w-[calc(100%-2rem)] sm:m-5 sm:w-[calc(100%-2.5rem)]" />
      </div>
    </div>
  )
}
