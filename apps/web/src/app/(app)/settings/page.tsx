'use client'

import { useState } from 'react'
import { LanguageSection } from '@/features/settings/components/language-section'
import { AccountPlanSection } from '@/features/settings/components/account-plan-section'
import { NotificationPreferencesPanel } from '@/features/notifications/components/notification-preferences-panel'
import { NotificationWebhooksPanel } from '@/features/integrations'
import { useTranslation } from '@/lib/i18n'

type SettingsTab = 'all' | 'notifications' | 'integrations' | 'plan' | 'language'

export default function SettingsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('all')

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'all', label: t('settings.tabs.general') },
    { id: 'notifications', label: t('settings.tabs.notifications') },
    { id: 'integrations', label: t('settings.tabs.integrations') },
    { id: 'plan', label: t('settings.tabs.billing') },
    { id: 'language', label: t('settings.language.title') },
  ]

  return (
    <div className="flex flex-col w-full animate-page-enter">
      <h1 className="sr-only">{t('settings.title')}</h1>

      <div className="border-b border-border/80 px-4 sm:px-6 lg:px-8 pt-4 pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <p className="text-xs text-muted max-w-2xl">
            {t('settings.subtitle')}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex items-center gap-6 overflow-x-auto">
          {tabs.map((tab) => {
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-xs sm:text-sm font-medium transition-all duration-150 relative cursor-pointer active:scale-[0.98] ${
                  isSelected
                    ? 'text-default font-semibold'
                    : 'text-muted hover:text-default'
                }`}
              >
                <span>{tab.label}</span>
                {isSelected && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-6 px-4 sm:px-6 lg:px-8 py-6">
        {(activeTab === 'all' || activeTab === 'plan') && <AccountPlanSection />}
        {(activeTab === 'all' || activeTab === 'notifications') && <NotificationPreferencesPanel />}
        {(activeTab === 'all' || activeTab === 'integrations') && <NotificationWebhooksPanel />}
        {(activeTab === 'all' || activeTab === 'language') && <LanguageSection />}
      </div>
    </div>
  )
}
