'use client'

import {
  Briefcase,
  Buildings,
  CheckCircle,
  FolderOpen,
  Sparkle,
  Users,
} from '@phosphor-icons/react'
import type { Plan } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { StateView } from '@/components/ui/state-view'
import { useOrganizationUsage } from '@/features/organizations/hooks/use-organization-usage'
import { useTranslation } from '@/lib/i18n'
import { formatCreditsReset, usagePercent } from '../lib/plan-usage'

const PLAN_ICONS: Record<Plan, typeof Briefcase> = {
  gratuito: Briefcase,
  equipo: Users,
  empresa: Buildings,
}

const FEATURE_KEYS = [
  'settings.planUsage.featureJunitIngestion',
  'settings.planUsage.featureTraceability',
  'settings.planUsage.featureCaseHealth',
  'settings.planUsage.featureNotifications',
  'settings.planUsage.featureCiKeys',
  'settings.planUsage.featureAeris',
  'settings.planUsage.featureDashboard',
] as const

type Translate = (key: string, vars?: Record<string, string | number>) => string

interface UsageMeterProps {
  icon: typeof Briefcase
  label: string
  used: number
  limit: number | null
  t: Translate
}

function UsageMeter({ icon: Icon, label, used, limit, t }: UsageMeterProps) {
  const percent = usagePercent(used, limit)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-medium text-default">
        <Icon size={14} aria-hidden="true" className="text-muted shrink-0" />
        <span>{label}</span>
      </div>
      {limit === null || percent === null ? (
        <p className="text-xs text-muted">
          {t('settings.planUsage.meterLabelUnlimited', { label })}
        </p>
      ) : (
        <>
          <div
            role="progressbar"
            aria-label={t('settings.planUsage.meterLabel', { label, used, limit })}
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-canvas"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted tabular-nums">
            {used} / {limit}
          </p>
        </>
      )}
    </div>
  )
}

export function PlanUsageSection() {
  const { t, locale } = useTranslation()
  const { usage, isLoading, isError } = useOrganizationUsage()

  if (isLoading || (!usage && !isError)) {
    return (
      <section aria-labelledby="plan-usage-heading" className="space-y-5">
        <h2 id="plan-usage-heading" className="sr-only">
          {t('settings.planUsage.title')}
        </h2>
        <StateView kind="loading" title={t('common.loading')} />
      </section>
    )
  }

  if (isError || !usage) {
    return (
      <section aria-labelledby="plan-usage-heading" className="space-y-5">
        <h2 id="plan-usage-heading" className="sr-only">
          {t('settings.planUsage.title')}
        </h2>
        <StateView kind="error" title={t('settings.planUsage.loadError')} />
      </section>
    )
  }

  const PlanIcon = PLAN_ICONS[usage.plan]
  const resetDate = formatCreditsReset(usage.creditsResetAt, locale)

  return (
    <section className="space-y-5" aria-labelledby="plan-usage-heading">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="plan-usage-heading" className="text-sm font-semibold text-default">
          {t('settings.planUsage.title')}
        </h2>
        <Badge variant="default" className="gap-1.5 px-2.5 py-0.5 text-xs font-semibold">
          <PlanIcon size={12} weight="bold" aria-hidden="true" />
          <span>{t(`settings.planUsage.${usage.plan}`)}</span>
        </Badge>
      </div>
      <p className="text-xs text-muted leading-relaxed max-w-xl -mt-3">
        {t('settings.planUsage.description')}
      </p>

      <Card className="rounded-xl border border-border bg-surface shadow-card">
        <CardContent className="p-5 sm:p-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <UsageMeter
            icon={Users}
            label={t('settings.planUsage.membersLabel')}
            used={usage.members}
            limit={usage.limits.members}
            t={t}
          />
          <UsageMeter
            icon={FolderOpen}
            label={t('settings.planUsage.projectsLabel')}
            used={usage.projects}
            limit={usage.limits.projects}
            t={t}
          />
          <div className="space-y-1.5">
            <UsageMeter
              icon={Sparkle}
              label={t('settings.planUsage.creditsLabel')}
              used={usage.aiCreditsUsed}
              limit={usage.limits.monthlyAiCredits}
              t={t}
            />
            <p className="text-[11px] text-muted">
              {t('settings.planUsage.resetsOn', { date: resetDate })}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-border bg-surface shadow-card">
        <CardContent className="p-5 sm:p-6">
          <h3 className="text-sm font-semibold text-default">
            {t('settings.planUsage.includedFeaturesTitle')}
          </h3>
          <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {FEATURE_KEYS.map((key) => (
              <li key={key} className="flex items-start gap-2 text-xs text-default">
                <CheckCircle size={14} weight="fill" className="text-pass shrink-0 mt-0.5" aria-hidden="true" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  )
}
