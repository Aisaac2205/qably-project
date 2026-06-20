'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTab, TabsPanel } from '@/components/ui/tabs'
import { OrgSection } from './org-section'
import { MembersSection } from './members-section'
import { ApiKeysSection } from './api-keys-section'
import { IntegrationsSection } from './integrations-section'

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'members', label: 'Members' },
  { value: 'api-keys', label: 'API Keys' },
  { value: 'integrations', label: 'Integrations' },
] as const

type TabValue = (typeof TABS)[number]['value']

export function SettingsTabs() {
  const [activeTab, setActiveTab] = useState<TabValue>('general')

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-default">Settings</h1>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="w-fit">
          {TABS.map((tab) => (
            <TabsTab key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTab>
          ))}
        </TabsList>

        <TabsPanel value="general" className="mt-4">
          <OrgSection />
        </TabsPanel>

        <TabsPanel value="members" className="mt-4">
          <MembersSection />
        </TabsPanel>

        <TabsPanel value="api-keys" className="mt-4">
          <ApiKeysSection />
        </TabsPanel>

        <TabsPanel value="integrations" className="mt-4">
          <IntegrationsSection />
        </TabsPanel>
      </Tabs>
    </div>
  )
}
