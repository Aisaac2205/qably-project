import React, { useState } from 'react'
import {
  BellSimple,
  CaretUpDown,
  FolderSimple,
  GearSix,
  LockSimple,
  SidebarSimple,
  SquaresFour,
  Tray,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import type { DashboardPeriod } from '@qably/types'
import {
  MOCK_DASHBOARD_OVERVIEWS,
  MOCK_DASHBOARD_CHANNELS,
  MOCK_DEMO_USER,
} from '../data/mock-dashboard-data'
import { syncPreviewLocale } from '../lib/sync-preview-locale'
import { DashboardHeader } from './dashboard-header'
import { KpiStrip } from './kpi-strip'
import { PassRateHero } from './pass-rate-hero'
import { ProjectsTable } from './projects-table'
import { CasesGaugeCard } from './cases-gauge-card'
import { ChannelsCard } from './channels-card'
import { ActivityCard } from './activity-card'
import type { HeroTranslations, Locale } from '@/features/i18n/types'
import { useTranslation } from '@/lib/i18n'

export interface DashboardWindowFrameProps {
  tHero?: HeroTranslations
  locale?: Locale
}

type NavSection = 'dashboard' | 'projects' | 'review-inbox' | 'notifications' | 'settings'

export function DashboardWindowFrame({ locale }: DashboardWindowFrameProps) {
  syncPreviewLocale(locale)

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard')
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>(30)
  const { t } = useTranslation()

  const overview = MOCK_DASHBOARD_OVERVIEWS[selectedPeriod]
  const channels = MOCK_DASHBOARD_CHANNELS

  const navItems: { id: NavSection; label: string; icon: Icon }[] = [
    { id: 'dashboard', label: t('sidebar.dashboard'), icon: SquaresFour },
    { id: 'projects', label: t('sidebar.projects'), icon: FolderSimple },
    { id: 'review-inbox', label: t('sidebar.reviewInbox'), icon: Tray },
    { id: 'notifications', label: t('sidebar.notifications'), icon: BellSimple },
    { id: 'settings', label: t('sidebar.settings'), icon: GearSix },
  ]

  return (
    <div
      data-dashboard-preview
      className="flex h-[clamp(640px,94vh,1120px)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-sidebar font-sans text-default shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
    >
      {/* Browser chrome — top window bar with domain pill */}
      <div className="flex shrink-0 select-none items-center justify-between border-b border-border bg-canvas px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-[#ff5f56]" aria-hidden="true" />
          <span className="size-3 rounded-full bg-[#ffbd2e]" aria-hidden="true" />
          <span className="size-3 rounded-full bg-[#27c93f]" aria-hidden="true" />
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1 text-[11px] font-medium text-muted">
          <LockSimple size={12} weight="bold" aria-hidden="true" />
          <span>qably.dev/dashboard</span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
          <span className="size-2 rounded-full bg-pass animate-pulse" aria-hidden="true" />
          <span className="hidden sm:inline">Live</span>
        </div>
      </div>

      {/* Product AppShell: Sidebar + Main Content Inset */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[13rem_minmax(0,1fr)] bg-sidebar text-left">
        <aside className="flex min-h-0 flex-col bg-sidebar text-sidebar-fg border-r border-border">
          <div className="flex h-14 flex-col justify-center border-b border-border p-2">
            <div className="flex h-10 w-full items-center px-0.5">
              <span className="flex h-10 flex-1 items-center rounded-lg px-2 transition-colors hover:bg-sidebar-hover">
                <img src="/qably-sidebar.svg" alt="Qably" className="h-7 w-auto translate-y-0.5 object-contain" />
              </span>
            </div>
          </div>

          <nav aria-label="Sidebar preview" className="flex min-h-0 flex-1 flex-col p-2">
            <ul className="flex w-full min-w-0 flex-col gap-0.5">
              {navItems.map((item) => {
                const isActive = activeNav === item.id
                return (
                  <li key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveNav(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-sidebar-active font-medium text-default shadow-xs'
                          : 'text-sidebar-fg-muted hover:text-default hover:bg-sidebar-hover'
                      }`}
                    >
                      <item.icon size={16} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="flex flex-col gap-2 p-2">
            <span className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2 text-left">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-fg"
              >
                {MOCK_DEMO_USER.initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight text-default">
                  {MOCK_DEMO_USER.name}
                </span>
                <span className="block truncate text-xs leading-normal text-muted">
                  {t('settings.members.roleOwner')}
                </span>
              </span>
              <CaretUpDown size={16} aria-hidden="true" className="shrink-0 text-muted" />
            </span>
          </div>
        </aside>

        {/* Right inset: TopBar + Dashboard Canvas */}
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-surface">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <SidebarSimple size={18} className="shrink-0 text-muted" aria-hidden="true" />
              <h1 className="text-base font-semibold tracking-[-0.015em] text-default md:text-lg">
                {t('sidebar.dashboard')}
              </h1>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <span className="relative flex size-8 items-center justify-center rounded-lg text-default transition-colors hover:bg-surface-hover">
                <BellSimple size={18} aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-fail px-1 text-center text-[10px] font-semibold leading-4 text-white"
                >
                  2
                </span>
              </span>

              <span className="flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                {MOCK_DEMO_USER.initials}
              </span>
            </div>
          </header>

          <main
            id="dashboard-preview-main"
            className="min-h-0 flex-1 overflow-y-auto bg-surface flex flex-col"
          >
            <section
              aria-label="Dashboard"
              className="@container w-full space-y-5 px-5 py-6 text-default @md:space-y-6 sm:px-7 lg:px-9 lg:py-6"
            >
              <DashboardHeader period={selectedPeriod} onPeriodChange={setSelectedPeriod} />
              <KpiStrip overview={overview} period={selectedPeriod} />
              <PassRateHero overview={overview} period={selectedPeriod} />

              <div className="mx-auto w-full max-w-dashboard @container">
                <div data-testid="dashboard-row-grid" className="grid grid-cols-1 gap-5 @3xl:grid-cols-3 @md:gap-6">
                  <div className="min-w-0 @3xl:col-span-2">
                    <ProjectsTable overview={overview} />
                  </div>
                  <div className="min-w-0">
                    <CasesGaugeCard overview={overview} />
                  </div>
                </div>
              </div>

              <div className="mx-auto w-full max-w-dashboard @container">
                <div data-testid="dashboard-row-grid" className="grid grid-cols-1 gap-5 @3xl:grid-cols-2 @md:gap-6">
                  <div className="min-w-0">
                    <ChannelsCard channels={channels} />
                  </div>
                  <div className="min-w-0">
                    <ActivityCard overview={overview} />
                  </div>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  )
}
