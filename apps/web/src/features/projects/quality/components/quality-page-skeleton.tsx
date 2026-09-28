'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'

const SHELL_CLASSES =
  'mx-auto w-full max-w-dashboard space-y-6 px-5 py-6 text-default sm:px-7 lg:px-9 lg:py-6 animate-page-enter'
const KPI_CARD_COUNT = 4

export function QualityPageSkeleton() {
  const { t } = useTranslation()

  return (
    <div className={SHELL_CLASSES} aria-busy="true">
      <span role="status" className="sr-only">
        {t('quality.loading')}
      </span>

      <Skeleton className="h-4 w-40" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-3 @xs:grid-cols-2 @2xl:grid-cols-4">
        {Array.from({ length: KPI_CARD_COUNT }, (_, index) => (
          <Skeleton key={index} className="h-[168px] rounded-xl" />
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <Skeleton className="mb-3 h-4 w-56" />
        <Skeleton className="h-[320px] w-full rounded-lg" />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
    </div>
  )
}
