'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'

const TAB_COUNT = 2
const ROW_COUNT = 5

export function RunsPageSkeleton() {
  const { t } = useTranslation()

  return (
    <div
      className="w-full space-y-6 px-5 py-6 sm:px-7 lg:px-9 lg:py-6 animate-page-enter"
      aria-busy="true"
    >
      <span role="status" className="sr-only">
        {t('runs.loading')}
      </span>

      <Skeleton className="h-5 w-40" />

      <div className="space-y-4">
        <div className="flex items-end gap-1 border-b border-border">
          {Array.from({ length: TAB_COUNT }, (_, index) => (
            <div key={index} className="flex min-h-11 items-center px-3 md:min-h-10">
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>

        <div className="rule-bleed !px-0 border-y border-border">
          <div className="divide-y divide-border">
            {Array.from({ length: ROW_COUNT }, (_, index) => (
              <div
                key={index}
                className="flex items-start gap-3.5 px-5 py-3 sm:px-7 sm:py-3.5 lg:px-9"
              >
                <Skeleton className="h-6 w-24 shrink-0" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
