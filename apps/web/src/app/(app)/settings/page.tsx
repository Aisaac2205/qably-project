/**
 * /settings — trimmed down to language only after Commit 2 absorbed
 * integrations / api-keys / members / org / billing / ai-providers
 * into their respective transactional modules.
 */
'use client'

import { LanguageSection } from '@/features/settings/components/language-section'
import { AccountPlanSection } from '@/features/settings/components/account-plan-section'
import { IntegrationsGovernanceSection } from '@/features/settings/components/integrations-governance-section'
import { useTranslation } from '@/lib/i18n'

export default function SettingsPage() {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col">
      <div className="px-6 pt-6 pb-0 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-default">{t('settings.title')}</h1>
        <p className="text-sm text-muted mt-0.5">{t('settings.subtitle')}</p>
      </div>
        <div className="space-y-5 px-6 pt-5 pb-6">
          <AccountPlanSection />
          <IntegrationsGovernanceSection />
          <LanguageSection />
      </div>
    </div>
  )
}
