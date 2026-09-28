import React, { useState } from 'react'
import {
  BellSimple,
  SidebarSimple,
} from '@phosphor-icons/react'
import { Iphone16Pro } from '@/components/ui/iphone-16-pro'
import type { DashboardPeriod } from '@qably/types'
import {
  MOCK_DASHBOARD_OVERVIEWS,
  MOCK_DASHBOARD_CHANNELS,
  MOCK_DEMO_USER,
} from '@/features/dashboard-preview/data/mock-dashboard-data'
import { DashboardHeader } from '@/features/dashboard-preview/components/dashboard-header'
import { KpiStrip } from '@/features/dashboard-preview/components/kpi-strip'
import { PassRateHero } from '@/features/dashboard-preview/components/pass-rate-hero'
import { ProjectsTable } from '@/features/dashboard-preview/components/projects-table'
import { CasesGaugeCard } from '@/features/dashboard-preview/components/cases-gauge-card'
import { ChannelsCard } from '@/features/dashboard-preview/components/channels-card'
import { ActivityCard } from '@/features/dashboard-preview/components/activity-card'
import { syncPreviewLocale } from '@/features/dashboard-preview/lib/sync-preview-locale'
import type { Locale } from '@/features/i18n/types'
import { useTranslation } from '@/lib/i18n'

const SCREEN_WIDTH = 402
const SCREEN_HEIGHT = 874

export interface MobileDashboardIphoneProps {
  locale?: Locale
}

export function MobileDashboardIphone({ locale }: MobileDashboardIphoneProps) {
  syncPreviewLocale(locale)

  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>(30)
  const { t } = useTranslation()

  const overview = MOCK_DASHBOARD_OVERVIEWS[selectedPeriod]
  const channels = MOCK_DASHBOARD_CHANNELS

  return (
    <div className="relative mx-auto flex select-none justify-center py-4">
      <div className="relative aspect-[200/400] w-[320px] drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)] sm:w-[360px]">
        <Iphone16Pro className="pointer-events-none absolute inset-0 z-20 size-full" />

        <div
          data-dashboard-preview
          className="absolute z-10 overflow-hidden bg-surface font-sans text-default"
          style={{
            left: '7.04%',
            top: '3.2%',
            width: '85.99%',
            height: '93.59%',
            borderRadius: '24.62px',
          }}
        >
          <div
            className="@container origin-top-left scale-[0.6845] sm:scale-[0.7701]"
            style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
          >
            <div className="flex h-full flex-col">
          {/* iOS Status Bar */}
          <div className="flex h-9 shrink-0 items-center justify-between bg-surface px-8 pt-2 text-[10px] font-semibold text-default border-b border-border/30">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-medium tracking-tight">5G</span>
              <span className="flex h-2.5 w-4 rounded-[3px] border border-default p-0.5">
                <span className="h-full w-2.5 rounded-[1px] bg-default" />
              </span>
            </div>
          </div>

          {/* Compact Top Bar */}
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <SidebarSimple size={18} className="shrink-0 text-default" aria-hidden="true" />
              <h1 className="truncate text-base font-semibold tracking-[-0.015em] text-default">
                {t('sidebar.dashboard')}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="relative flex size-8 items-center justify-center rounded-lg text-default">
                <BellSimple size={18} aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="absolute -top-0.5 -right-0.5 min-w-4 rounded-full bg-fail px-1 text-center text-[10px] font-semibold leading-4 text-white"
                >
                  1
                </span>
              </span>

              <span
                aria-label={MOCK_DEMO_USER.name}
                className="flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg"
              >
                {MOCK_DEMO_USER.initials}
              </span>
            </div>
          </header>

          {/* Main Scrollable Content Area */}
          <main className="@container flex-1 overflow-y-auto space-y-5 px-4 py-5 scrollbar-none text-left bg-surface text-default">
            <DashboardHeader period={selectedPeriod} onPeriodChange={setSelectedPeriod} />

            <KpiStrip overview={overview} period={selectedPeriod} />
            <PassRateHero overview={overview} period={selectedPeriod} />

            <div className="mx-auto w-full max-w-dashboard @container">
              <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-3 @md:gap-6">
                <div className="min-w-0 @3xl:col-span-2">
                  <ProjectsTable overview={overview} />
                </div>
                <div className="min-w-0">
                  <CasesGaugeCard overview={overview} />
                </div>
              </div>
            </div>

            <div className="mx-auto w-full max-w-dashboard @container">
              <div className="grid grid-cols-1 gap-5 @3xl:grid-cols-2 @md:gap-6">
                <div className="min-w-0">
                  <ChannelsCard channels={channels} />
                </div>
                <div className="min-w-0">
                  <ActivityCard overview={overview} />
                </div>
              </div>
            </div>
          </main>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
