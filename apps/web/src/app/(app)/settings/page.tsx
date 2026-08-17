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
      <h1 className="sr-only">{t('settings.title')}</h1>
      <div className="space-y-5 px-6 pt-5 pb-6">
        <AccountPlanSection />
        <IntegrationsGovernanceSection />
        <LanguageSection />
      </div>
    </div>
  )
}
