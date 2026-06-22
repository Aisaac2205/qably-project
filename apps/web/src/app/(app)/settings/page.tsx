'use client'

import { SettingsTabs } from '@/features/settings/components/settings-tabs'

export default function SettingsPage() {
  return (
    <div className="flex flex-col">
      <div className="px-6 pt-6 pb-0 shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-default">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Manage your organization, members, integrations and notifications</p>
      </div>
      <SettingsTabs />
    </div>
  )
}
