'use client'

import { Gauge } from '@qably/ui/dashboard'
import { computePassRate } from '@qably/types'
import type { DashboardPeriod } from '@qably/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StateView } from '@/components/ui/state-view'
import { Button } from '@/components/ui/button'
import { useDashboardOverview } from '@/features/dashboard/hooks/use-dashboard-overview'
import { formatNumber } from '@/features/dashboard/lib/format'
import { useTranslation } from '@/lib/i18n'

export interface CasesGaugeCardProps {
  period: DashboardPeriod
  projectId?: string
}

export function CasesGaugeCard({ period, projectId }: CasesGaugeCardProps) {
  const { overview, isLoading, isError, retry } = useDashboardOverview(period, projectId)
  const { t } = useTranslation()
  const title = t('dashboard.casesTitle')

  const rate =
    overview === undefined
      ? null
      : computePassRate({
          pass: overview.casesPassing.pass,
          fail: overview.casesPassing.fail,
          blocked: overview.casesPassing.blocked,
        })

  return (
    <Card as="section" aria-labelledby="cases-gauge-heading" className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle as="h2" id="cases-gauge-heading">
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 pt-0">
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
        ) : isLoading || overview === undefined ? (
          <Skeleton className="size-32 rounded-full" />
        ) : rate === null ? (
          <StateView kind="empty" title={t('dashboard.casesEmptyTitle')} />
        ) : (
          <>
            <Gauge value={Math.round(rate * 100)} label={t('dashboard.casesGaugeLabel')}>
              <span className="text-2xl font-semibold tabular-nums text-default">
                {Math.round(rate * 100)}%
              </span>
            </Gauge>
            <p className="text-xs font-medium text-default tabular-nums">
              {t('dashboard.casesPassedOf', {
                passed: overview.casesPassing.pass,
                total: overview.casesPassing.total,
              })}
            </p>
            <dl className="grid w-full grid-cols-3 gap-2 text-center text-xs">
              <div>
                <dt className="text-muted">{t('dashboard.casesFailedLabel')}</dt>
                <dd data-testid="cases-failed" className="font-semibold text-default tabular-nums">
                  {formatNumber(overview.casesPassing.fail)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t('dashboard.casesSkippedLabel')}</dt>
                <dd data-testid="cases-skipped" className="font-semibold text-default tabular-nums">
                  {formatNumber(overview.casesPassing.skip)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{t('dashboard.casesBlockedLabel')}</dt>
                <dd data-testid="cases-blocked" className="font-semibold text-default tabular-nums">
                  {formatNumber(overview.casesPassing.blocked)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}
