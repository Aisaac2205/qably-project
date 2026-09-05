'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from '@/lib/i18n'

export type RouteSkeletonVariant = 'list' | 'detail'

export interface RouteSkeletonProps {
  variant: RouteSkeletonVariant
  labelKey: string
}

const LIST_ROWS = 5
const DETAIL_ROWS = 3

export function RouteSkeleton({ variant, labelKey }: RouteSkeletonProps) {
  const { t } = useTranslation()

  return (
    <div
      className="w-full space-y-6 px-5 py-6 sm:px-7 lg:px-9 lg:py-6"
      aria-busy="true"
    >
      <span role="status" className="sr-only">
        {t(labelKey)}
      </span>

      <Skeleton className="h-4 w-40" />

      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {variant === 'list' ? (
        <div className="space-y-2">
          {Array.from({ length: LIST_ROWS }, (_, index) => (
            <Skeleton key={index} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="space-y-2">
            {Array.from({ length: DETAIL_ROWS }, (_, index) => (
              <Skeleton key={index} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
