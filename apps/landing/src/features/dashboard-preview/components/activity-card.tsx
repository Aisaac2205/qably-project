import React from 'react'
import type { DashboardOverviewRecord } from '@qably/types'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { ActivityRow } from './activity-row'
import { useTranslation } from '@/lib/i18n'

export interface ActivityCardProps {
  overview: DashboardOverviewRecord
}

export function ActivityCard({ overview }: ActivityCardProps) {
  const { t } = useTranslation()
  const title = t('dashboard.activityTitle')

  return (
    <Card as="section" aria-labelledby="activity-card-heading" className="flex h-full flex-col overflow-hidden">
      <CardHeader className="pb-4">
        <CardTitle as="h2" id="activity-card-heading">
          {title}
        </CardTitle>
      </CardHeader>

      <div className="flex flex-col divide-y divide-border px-5 pb-2">
        {overview.recentActivity.map((entry) => (
          <ActivityRow
            key={entry.kind === 'commit' ? `commit:${entry.projectId}:${entry.commitSha}` : entry.runId}
            entry={entry}
          />
        ))}
      </div>
    </Card>
  )
}
