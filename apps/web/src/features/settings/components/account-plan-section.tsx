'use client'

import { Buildings, Briefcase, FolderSimple, Sparkle, Users } from '@phosphor-icons/react'
import type { Plan } from '@qably/types'
import { Badge } from '@/components/ui/badge'
import { useOrg } from '@/lib/use-mock-store'
import { useTranslation } from '@/lib/i18n'

const planIcons: Record<Plan, typeof Briefcase> = {
  gratuito: Briefcase,
  equipo: Users,
  empresa: Buildings,
}

export function AccountPlanSection() {
  const org = useOrg()
  const { t } = useTranslation()
  const PlanIcon = planIcons[org.plan]
  const limits = [
    { label: t('settings.accountPlan.projects'), value: org.planLimits.maxProjects, Icon: FolderSimple },
    { label: t('settings.accountPlan.members'), value: org.planLimits.maxUsers, Icon: Users },
    { label: t('settings.accountPlan.aiCases'), value: org.planLimits.maxCases, Icon: Sparkle },
  ]

  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-labelledby="account-plan-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="account-plan-heading" className="text-sm font-semibold text-default">
            {t('settings.accountPlan.title')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('settings.accountPlan.description')}</p>
        </div>
        <Badge variant="default">
          <PlanIcon size={12} weight="bold" aria-hidden="true" />
          {t(`settings.accountPlan.${org.plan}`)}
        </Badge>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        {limits.map(({ label, value, Icon }) => (
          <div key={label} className="border-t border-border pt-3">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <Icon size={14} aria-hidden="true" />
              {label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-default">
              {t('settings.accountPlan.limit', { count: value })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
