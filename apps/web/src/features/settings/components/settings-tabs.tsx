'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs'
import { OrgSection } from './org-section'
import { MembersSection } from './members-section'
import { ApiKeysSection } from './api-keys-section'
import { IntegrationsSection } from './integrations-section'
import { AiProvidersSection } from './ai-providers-section'
import { BillingSection } from './billing-section'
import { LanguageSection } from './language-section'
import { useTranslation } from '@/lib/i18n'

const TABS = [
  { value: 'general', labelKey: 'settings.tabs.general' },
  { value: 'members', labelKey: 'settings.tabs.members' },
  { value: 'api-keys', labelKey: 'settings.tabs.apiKeys' },
  { value: 'integrations', labelKey: 'settings.tabs.integrations' },
  { value: 'billing', labelKey: 'settings.tabs.billing' },
] as const

export type TabValue = (typeof TABS)[number]['value']

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<TabValue>('general')
  const { t } = useTranslation()

  return (
    <div className="flex flex-col px-6 pt-5 pb-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="w-fit">
          {TABS.map((tab) => (
            <TabsTab key={tab.value} value={tab.value}>
              {t(tab.labelKey)}
            </TabsTab>
          ))}
        </TabsList>

        <TabsPanel value="general" className="mt-6 space-y-6">
          <LanguageSection />
          <OrgSection onNavigate={(tab) => setActiveTab(tab)} />
        </TabsPanel>

        <TabsPanel value="members" className="mt-6">
          <MembersSection />
        </TabsPanel>

        <TabsPanel value="api-keys" className="mt-6">
          <ApiKeysSection />
        </TabsPanel>

        <TabsPanel value="integrations" className="mt-6 space-y-6">
          <IntegrationsSection />
          <AiProvidersSection />
        </TabsPanel>

        <TabsPanel value="billing" className="mt-6">
          <BillingSection />
        </TabsPanel>
      </Tabs>
    </div>
  )
}
