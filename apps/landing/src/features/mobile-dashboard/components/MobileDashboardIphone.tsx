import React from 'react';
import {
  BellSimple,
  ChartBar,
  Play,
  SidebarSimple,
  Sparkle,
  Target,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { Iphone16Pro } from '@/components/ui/iphone-16-pro';
import {
  TRACEABILITY_LEVEL_COLORS,
  recentTraceabilityWeeks,
  traceabilityTotalLabel,
} from '@/features/dashboard-preview/components/RealTraceabilityCalendar';
import {
  MOCK_DASHBOARD_STATS,
  MOCK_DEMO_USER,
  MOCK_PROJECTS,
} from '@/features/dashboard-preview/data/mock-dashboard-data';
import type { DashboardTranslations, Locale } from '@/features/i18n/types';

interface MobileDashboardIphoneProps {
  tDashboard: DashboardTranslations;
  locale?: Locale;
}

const PREVIEW_YEAR = 2026;
const MOBILE_WEEK_COUNT = 14;
const MOBILE_CELL_SIZE = 8;
const MOBILE_CELL_GAP = 2.5;
const MOBILE_STEP = MOBILE_CELL_SIZE + MOBILE_CELL_GAP;

const MOBILE_CELLS = recentTraceabilityWeeks(MOBILE_WEEK_COUNT);

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.split(`{${key}}`).join(String(value)),
    template,
  );
}

interface MobileKpiProps {
  label: string;
  value: string | number;
  icon: Icon;
  footnote: string;
  footnoteClassName?: string;
}

function MobileKpi({ label, value, icon: KpiIcon, footnote, footnoteClassName }: MobileKpiProps) {
  return (
    <div className="rounded-lg border border-app-border bg-app-surface p-2 shadow-app-card">
      <div className="flex items-center justify-between gap-1 text-[9px] font-medium text-app-muted">
        <span className="truncate">{label}</span>
        <KpiIcon size={10} aria-hidden="true" className="shrink-0" />
      </div>
      <div className="mt-1 text-base font-semibold tabular-nums text-app-default">{value}</div>
      <div className={footnoteClassName ?? 'text-[8px] text-app-muted'}>{footnote}</div>
    </div>
  );
}

export function MobileDashboardIphone({ tDashboard, locale = 'es' }: MobileDashboardIphoneProps) {
  const isEn = locale === 'en';
  const totalLabel = traceabilityTotalLabel(isEn);

  const svgWidth = MOBILE_WEEK_COUNT * MOBILE_STEP;
  const svgHeight = 7 * MOBILE_STEP;

  return (
    <div className="relative mx-auto flex select-none justify-center py-4">
      <div className="relative aspect-[200/400] w-[300px] drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)] sm:w-[330px]">
        <Iphone16Pro className="pointer-events-none absolute inset-0 z-20 size-full" />

        <div
          className="absolute z-10 flex flex-col overflow-hidden bg-app-sidebar font-sans text-app-default"
          style={{
            left: '7.04%',
            top: '3.2%',
            width: '85.99%',
            height: '93.59%',
            borderRadius: '24.62px',
          }}
        >
          <div className="flex h-10 shrink-0 items-center justify-between bg-app-sidebar px-5 pt-2 text-[10px] font-semibold">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <span>5G</span>
              <span className="flex h-2 w-4 rounded-xs border border-app-default p-0.5">
                <span className="h-full w-2.5 rounded-2xs bg-app-default" />
              </span>
            </div>
          </div>

          <div className="flex h-11 shrink-0 items-center justify-between bg-app-sidebar px-3">
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                aria-label={tDashboard.toggleSidebar}
                className="flex size-6 shrink-0 items-center justify-center rounded-md text-app-sidebar-fg"
              >
                <SidebarSimple size={14} aria-hidden="true" />
              </span>
              <h3 className="truncate text-xs font-semibold tracking-[-0.015em]">{tDashboard.navDashboard}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="relative flex size-5 items-center justify-center">
                <BellSimple size={14} aria-hidden="true" />
                <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-app-fail" />
              </span>
              <span className="flex size-5 items-center justify-center rounded-full bg-app-primary text-[9px] font-bold text-app-primary-fg">
                {MOCK_DEMO_USER.initials}
              </span>
            </div>
          </div>

          <div className="m-1.5 mt-0 flex-1 space-y-2 overflow-y-auto rounded-xl bg-app-surface p-2 text-left ring-1 ring-app-border scrollbar-none">
            <div className="grid grid-cols-2 gap-1.5">
              <MobileKpi
                label={tDashboard.runsKpi}
                value={MOCK_DASHBOARD_STATS.runsLast7d}
                icon={Play}
                footnote={tDashboard.viewDetails}
              />
              <MobileKpi
                label={tDashboard.passRateKpi}
                value={`${MOCK_DASHBOARD_STATS.passRateLast7d}%`}
                icon={ChartBar}
                footnote={`+${MOCK_DASHBOARD_STATS.passRateTrend}%`}
                footnoteClassName="text-[8px] font-semibold text-app-pass"
              />
              <MobileKpi
                label={tDashboard.pendingAiKpi}
                value={MOCK_DASHBOARD_STATS.pendingProposals}
                icon={Sparkle}
                footnote={tDashboard.viewDetails}
              />
              <MobileKpi
                label={tDashboard.coverageGapsKpi}
                value={MOCK_DASHBOARD_STATS.coverageGapsCount}
                icon={Target}
                footnote={tDashboard.viewDetails}
              />
            </div>

            <div className="space-y-1.5 rounded-lg border border-app-border bg-app-surface p-2.5 shadow-app-card">
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold">
                <span className="truncate">{fill(tDashboard.traceabilityEventsShort, { count: totalLabel })}</span>
                <span className="shrink-0 text-[9px] font-normal text-app-muted">{PREVIEW_YEAR}</span>
              </div>

              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full"
                role="img"
                aria-label={isEn ? 'Traceability and governance calendar' : 'Calendario de trazabilidad y gobernanza'}
              >
                {MOBILE_CELLS.map((cell) => (
                  <rect
                    key={`${cell.week}-${cell.day}`}
                    x={cell.week * MOBILE_STEP}
                    y={cell.day * MOBILE_STEP}
                    width={MOBILE_CELL_SIZE}
                    height={MOBILE_CELL_SIZE}
                    rx={1.8}
                    ry={1.8}
                    fill={TRACEABILITY_LEVEL_COLORS[cell.level]}
                  />
                ))}
              </svg>

              <div className="flex items-center justify-end gap-1 text-[8px] text-app-muted">
                <span>{isEn ? 'Less' : 'Menos'}</span>
                {TRACEABILITY_LEVEL_COLORS.map((color) => (
                  <span
                    key={color}
                    aria-hidden="true"
                    className="inline-block size-1.5 rounded-[1px]"
                    style={{ backgroundColor: color }}
                  />
                ))}
                <span>{isEn ? 'More' : 'Más'}</span>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-app-border bg-app-surface p-2.5 shadow-app-card">
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold">
                <span className="truncate">{tDashboard.projectHealth}</span>
                <span className="shrink-0 text-[9px] font-normal text-app-muted">{tDashboard.viewAll}</span>
              </div>
              <div className="space-y-1.5">
                {MOCK_PROJECTS.slice(0, 3).map((project) => (
                  <div key={project.id} className="flex items-center justify-between gap-2 text-[9px]">
                    <span className="truncate font-medium text-app-default">{project.name}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span
                        aria-hidden="true"
                        className={`size-1.5 rounded-full ${
                          project.healthScore >= 80 ? 'bg-app-pass' : 'bg-app-fail'
                        }`}
                      />
                      <span className="font-mono font-semibold tabular-nums text-app-default">
                        {project.healthScore}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
