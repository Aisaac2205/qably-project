import React, { useState } from 'react';
import {
  ArrowSquareOut,
  ArrowUp,
  BellSimple,
  CalendarBlank,
  CaretDown,
  CaretRight,
  CaretUpDown,
  CheckCircle,
  CircleNotch,
  ChartBar,
  Code,
  FileText,
  FolderSimple,
  GearSix,
  LockSimple,
  Play,
  SidebarSimple,
  Sparkle,
  SquaresFour,
  Target,
  Tray,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { RealTraceabilityCalendar } from './RealTraceabilityCalendar';
import {
  MOCK_AI_PROPOSALS,
  MOCK_CI_PIPELINES,
  MOCK_DASHBOARD_RUNS,
  MOCK_DASHBOARD_STATS,
  MOCK_PROJECTS,
  MOCK_RISK_SIGNALS,
  type MockRiskSignal,
  type MockRunStatus,
} from '../data/mock-dashboard-data';
import type { DashboardTranslations, HeroTranslations } from '../../i18n/types';

interface DashboardWindowFrameProps {
  tDashboard: DashboardTranslations;
  tHero: HeroTranslations;
}

type NavSection = 'dashboard' | 'projects' | 'review-inbox' | 'notifications' | 'settings';

interface NavItem {
  id: NavSection;
  label: string;
  icon: Icon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: SquaresFour },
  { id: 'projects', label: 'Proyectos', icon: FolderSimple },
  { id: 'review-inbox', label: 'Bandeja de revisión', icon: Tray },
  { id: 'notifications', label: 'Notificaciones', icon: BellSimple },
  { id: 'settings', label: 'Configuración', icon: GearSix },
];

const STATUS_PRESENTATION: Record<
  MockRunStatus,
  { label: string; icon: Icon; tone: string; animated?: boolean }
> = {
  pass: { label: 'Aprobado', icon: CheckCircle, tone: 'bg-app-pass-bg text-app-pass' },
  fail: { label: 'Fallido', icon: XCircle, tone: 'bg-app-fail-bg text-app-fail' },
  running: { label: 'En ejecución', icon: CircleNotch, tone: 'bg-app-running-bg text-app-running', animated: true },
  skip: { label: 'Omitido', icon: XCircle, tone: 'bg-app-skip-bg text-app-muted' },
  blocked: { label: 'Bloqueado', icon: XCircle, tone: 'bg-app-blocked-bg text-app-blocked' },
  pending: { label: 'Pendiente', icon: CircleNotch, tone: 'bg-app-skip-bg text-app-muted' },
};

const SEVERITY_PRESENTATION: Record<
  MockRiskSignal['severity'],
  { label: string; color: string; badge: string }
> = {
  critical: { label: 'Critical', color: 'text-app-fail', badge: 'bg-app-fail-bg text-app-fail' },
  high: { label: 'High', color: 'text-app-warn', badge: 'bg-app-warn-bg text-app-warn' },
  medium: { label: 'Medium', color: 'text-app-running', badge: 'bg-app-running-bg text-app-running' },
  low: { label: 'Low', color: 'text-app-muted', badge: 'bg-app-canvas text-app-muted' },
};

function StatusChip({ status }: { status: MockRunStatus }) {
  const presentation = STATUS_PRESENTATION[status];
  const StatusIcon = presentation.icon;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold ${presentation.tone}`}
    >
      <StatusIcon
        size={12}
        weight="fill"
        aria-hidden="true"
        className={presentation.animated ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      {presentation.label}
    </span>
  );
}

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: Icon;
  trend?: { value: number; label: string };
}

function KpiCard({ label, value, icon: CardIcon, trend }: KpiCardProps) {
  return (
    <div className="group min-h-[120px] min-w-0 rounded-xl border border-app-border bg-app-surface p-4 text-left shadow-app-card transition-[border-color,box-shadow,transform,background-color] duration-150 ease-out hover:border-app-border-strong hover:bg-app-surface-raised">
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-center justify-between gap-3">
          <dt className="truncate text-xs font-medium text-app-muted transition-colors duration-150 group-hover:text-app-default">
            {label}
          </dt>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-app-border/50 bg-app-surface-raised text-app-muted transition-all duration-150 group-hover:border-app-border-strong group-hover:text-app-default">
            <CardIcon size={15} weight="regular" aria-hidden="true" />
          </span>
        </div>

        <div className="my-2.5">
          <dd className="text-3xl font-semibold tracking-tight tabular-nums text-app-default">{value}</dd>
        </div>

        <div className="flex min-h-5 items-center justify-between gap-2 border-t border-app-border/40 pt-2.5">
          {trend ? (
            <div className="flex items-center gap-1.5 text-xs tabular-nums">
              <span className="inline-flex items-center gap-0.5 font-semibold text-app-pass">
                <ArrowUp size={12} weight="bold" aria-hidden="true" />+{trend.value}%
              </span>
              <span className="truncate text-[11px] text-app-muted">{trend.label}</span>
            </div>
          ) : (
            <span className="text-[11px] text-app-muted/70 transition-colors duration-150 group-hover:text-app-muted">
              Ver detalles
            </span>
          )}

          <CaretRight
            size={12}
            weight="bold"
            aria-hidden="true"
            className="shrink-0 text-app-muted/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-app-default"
          />
        </div>
      </div>
    </div>
  );
}

const CHART_DATA = [
  { day: 'May 8', rate: 78 },
  { day: 'May 9', rate: 84 },
  { day: 'May 10', rate: 81 },
  { day: 'May 11', rate: 86 },
  { day: 'May 12', rate: 90 },
  { day: 'May 13', rate: 87 },
  { day: 'May 14', rate: 89 },
];

const CHART_WIDTH = 560;
const CHART_HEIGHT = 172;
const PLOT_LEFT = 36;
const PLOT_RIGHT = 548;
const PLOT_TOP = 12;
const PLOT_BOTTOM = 140;

function xPosition(index: number) {
  return PLOT_LEFT + (index / (CHART_DATA.length - 1)) * (PLOT_RIGHT - PLOT_LEFT);
}

function yPosition(rate: number) {
  return PLOT_TOP + ((100 - rate) / 100) * (PLOT_BOTTOM - PLOT_TOP);
}

const LINE_PATH = CHART_DATA.map((item, index) => {
  const command = index === 0 ? 'M' : 'L';
  return `${command} ${xPosition(index)} ${yPosition(item.rate)}`;
}).join(' ');

const AREA_PATH = `${LINE_PATH} L ${xPosition(CHART_DATA.length - 1)} ${PLOT_BOTTOM} L ${PLOT_LEFT} ${PLOT_BOTTOM} Z`;

interface QueueSectionProps {
  title: string;
  children: React.ReactNode;
}

function QueueSection({ title, children }: QueueSectionProps) {
  return (
    <section className="flex h-full min-w-0 flex-col p-5 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-[-0.01em] text-app-default">{title}</h2>
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-app-primary">
          Ver todo
          <CaretRight size={11} weight="bold" aria-hidden="true" />
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-between divide-y divide-app-border">{children}</div>
    </section>
  );
}

export function DashboardWindowFrame({ tDashboard }: DashboardWindowFrameProps) {
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-app-border-sidebar bg-app-sidebar font-sans text-app-default shadow-[0_25px_80px_rgba(0,0,0,0.85)]">
      {/* Browser chrome — the window that hosts the product shell */}
      <div className="flex select-none items-center justify-between border-b border-app-border-sidebar bg-app-canvas px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-3 rounded-full bg-[#ff5f56]" aria-hidden="true" />
          <span className="size-3 rounded-full bg-[#ffbd2e]" aria-hidden="true" />
          <span className="size-3 rounded-full bg-[#27c93f]" aria-hidden="true" />
        </div>

        <div className="flex items-center gap-1.5 rounded-md border border-app-border bg-app-surface px-3 py-1 text-[11px] font-medium text-app-muted">
          <LockSimple size={12} weight="bold" aria-hidden="true" />
          <span>qably.dev/dashboard</span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-app-muted">
          <span className="size-2 rounded-full bg-app-pass" aria-hidden="true" />
          <span className="hidden sm:inline">Live</span>
        </div>
      </div>

      {/* Product shell — mirrors the AppShell of apps/web (sidebar + inset) */}
      <div className="grid min-w-0 grid-cols-[13rem_minmax(0,1fr)] bg-app-sidebar text-left">
        <aside className="flex min-h-0 flex-col bg-app-sidebar text-app-sidebar-fg">
          <div className="flex h-14 flex-col justify-center p-2">
            <div className="flex h-10 w-full items-center justify-between gap-1.5 px-0.5">
              <span className="flex h-10 flex-1 items-center rounded-lg px-2 transition-colors hover:bg-app-sidebar-hover">
                <img src="/qably-sidebar.svg" alt="Qably" className="h-7 w-auto translate-y-0.5 object-contain" />
              </span>
              <button
                type="button"
                aria-label="Toggle sidebar"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-app-sidebar-fg transition-colors hover:bg-app-surface-hover hover:text-app-default"
              >
                <SidebarSimple size={20} weight="bold" aria-hidden="true" />
              </button>
            </div>
          </div>

          <nav aria-label="Sidebar preview" className="flex min-h-0 flex-1 flex-col p-2">
            <ul className="flex w-full min-w-0 flex-col gap-0">
              {NAV_ITEMS.map((item) => {
                const isActive = activeNav === item.id;
                return (
                  <li key={item.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setActiveNav(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex h-8 w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm transition-colors ${
                        isActive
                          ? 'bg-app-sidebar-active font-normal text-app-sidebar-fg'
                          : 'text-app-sidebar-fg hover:bg-app-sidebar-active'
                      }`}
                    >
                      <item.icon size={16} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex flex-col gap-2 p-2">
            <span className="flex h-12 w-full items-center gap-2.5 rounded-xl border border-app-border-sidebar bg-app-sidebar/50 px-3 py-2 text-left">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-app-primary text-xs font-semibold text-app-primary-fg"
              >
                IF
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium leading-tight text-app-sidebar-fg">Isaac F.</span>
                <span className="block truncate text-xs leading-normal text-app-sidebar-fg-muted">Administrador</span>
              </span>
              <CaretUpDown size={16} aria-hidden="true" className="shrink-0 text-app-sidebar-fg-muted" />
            </span>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-app-sidebar">
          <header className="flex h-14 shrink-0 items-center justify-between bg-app-sidebar px-4 md:px-6">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <h1 className="text-base font-semibold tracking-[-0.015em] text-app-default md:text-lg">Dashboard</h1>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="relative flex size-8 items-center justify-center rounded-lg text-app-default transition-colors hover:bg-app-surface-hover">
                <BellSimple size={18} aria-hidden="true" />
                <span
                  aria-hidden="true"
                  className="absolute -right-1 -top-1 min-w-4 rounded-full bg-app-fail px-1 text-center text-[10px] font-semibold leading-4 text-app-primary-fg"
                >
                  2
                </span>
              </span>

              <span className="flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-app-primary text-xs font-bold text-app-primary-fg">
                IF
              </span>
            </div>
          </header>

          <main className="m-3 mt-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-app-surface shadow-app-pop ring-1 ring-app-border">
            <section
              aria-label="Dashboard"
              className="w-full space-y-6 px-5 py-6 text-app-default sm:px-7 lg:px-9 lg:py-6"
            >
              <section aria-label="Quality overview" className="min-w-0">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard label={tDashboard.runsKpi} value={MOCK_DASHBOARD_STATS.runsLast7d} icon={Play} />
                  <KpiCard
                    label={tDashboard.passRateKpi}
                    value={`${MOCK_DASHBOARD_STATS.passRateLast7d}%`}
                    icon={ChartBar}
                    trend={{ value: MOCK_DASHBOARD_STATS.passRateTrend, label: tDashboard.vsPrior7d }}
                  />
                  <KpiCard
                    label={tDashboard.pendingAiKpi}
                    value={MOCK_DASHBOARD_STATS.pendingProposals}
                    icon={Sparkle}
                  />
                  <KpiCard
                    label={tDashboard.coverageGapsKpi}
                    value={MOCK_DASHBOARD_STATS.coverageGapsCount}
                    icon={Target}
                  />
                </dl>
              </section>

              <section className="rounded-xl border border-app-border bg-app-surface p-5 shadow-xs md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.015em] text-app-default">Trazabilidad</h2>
                    <p className="mt-0.5 text-xs text-app-muted">
                      Trazabilidad en vivo entre repositorios, propuestas, casos oficiales y ejecuciones
                    </p>
                    <div className="mt-1.5">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-app-default">
                        Bandeja de revisión
                        <CaretRight size={11} weight="bold" aria-hidden="true" />
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-9 min-w-[175px] items-center justify-between gap-2.5 rounded-lg border border-app-border bg-app-canvas px-3 py-1.5 text-xs font-medium text-app-default shadow-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="shrink-0 text-app-muted">
                          <CalendarBlank size={14} weight="bold" aria-hidden="true" />
                        </span>
                        <span>Todas las etapas</span>
                        <span className="inline-flex items-center justify-center rounded-full bg-app-border/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-app-muted">
                          922
                        </span>
                      </span>
                      <CaretUpDown size={13} weight="bold" aria-hidden="true" className="shrink-0 text-app-muted" />
                    </span>

                    <span className="flex h-9 min-w-[84px] items-center justify-between gap-2.5 rounded-lg border border-app-border bg-app-canvas px-3 py-1.5 text-xs font-semibold text-app-default shadow-xs">
                      <span>2026</span>
                      <CaretUpDown size={13} weight="bold" aria-hidden="true" className="shrink-0 text-app-muted" />
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <RealTraceabilityCalendar />
                </div>
              </section>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,1fr)]">
                <div className="col-span-1 flex flex-col justify-between rounded-xl border border-app-border/80 bg-app-surface shadow-app-card">
                  <div className="flex flex-row items-center justify-between p-5 pb-4">
                    <h3 className="text-sm font-semibold text-app-default">{tDashboard.projectHealth}</h3>
                    <span className="text-xs font-semibold text-app-primary">{tDashboard.viewAll}</span>
                  </div>

                  <div className="flex-1">
                    <div className="w-full overflow-x-auto">
                      <table className="w-full min-w-[400px] border-collapse text-left">
                        <thead>
                          <tr className="border-b border-app-border bg-app-canvas/40">
                            <th className="px-5 py-3 text-xs font-medium text-app-muted">{tDashboard.thProject}</th>
                            <th className="px-3 py-3 text-xs font-medium text-app-muted">{tDashboard.thHealth}</th>
                            <th className="px-3 py-3 text-xs font-medium text-app-muted">{tDashboard.thLastRun}</th>
                            <th className="px-3 py-3 text-center text-xs font-medium text-app-muted">
                              {tDashboard.thSuites}
                            </th>
                            <th className="px-5 py-3 text-center text-xs font-medium text-app-muted">
                              {tDashboard.thAiPending}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border/60">
                          {MOCK_PROJECTS.map((project) => (
                            <tr key={project.id} className="transition-colors hover:bg-app-canvas/20">
                              <td className="px-5 py-3.5">
                                <span className="text-xs font-semibold text-app-default">{project.name}</span>
                              </td>
                              <td className="px-3 py-3.5">
                                <div className="flex items-center gap-2">
                                  <StatusChip status={project.lastRunStatus} />
                                  <span className="font-mono text-xs font-semibold tabular-nums text-app-default">
                                    {project.healthScore}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3.5 text-xs text-app-muted">{project.lastRunAt}</td>
                              <td className="px-3 py-3.5 text-center font-mono text-xs font-medium tabular-nums text-app-default">
                                {project.suiteCount}
                              </td>
                              <td className="px-5 py-3.5 text-center font-mono text-xs font-medium tabular-nums">
                                {project.aiPendingCount > 0 ? (
                                  <span className="font-semibold text-app-primary">{project.aiPendingCount}</span>
                                ) : (
                                  <span className="text-app-muted/60">0</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="col-span-1 flex flex-col justify-between rounded-xl border border-app-border/80 bg-app-surface shadow-app-card">
                  <div className="flex flex-row items-center justify-between p-5 pb-2">
                    <h3 className="text-sm font-semibold text-app-default">{tDashboard.passRateTrend}</h3>
                    <span className="flex items-center gap-1.5 rounded-lg border border-app-border bg-app-canvas px-2 py-1 text-xs font-semibold text-app-muted">
                      <span>7 days</span>
                      <CaretDown size={10} aria-hidden="true" />
                    </span>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5 pt-0">
                    <div className="mb-4 flex items-baseline gap-2">
                      <span className="text-3xl font-semibold tracking-[-0.025em] tabular-nums text-app-default">
                        {MOCK_DASHBOARD_STATS.passRateLast7d}%
                      </span>
                      <div className="flex items-center gap-0.5 text-xs font-semibold tabular-nums text-app-pass">
                        <ArrowUp size={12} weight="bold" aria-hidden="true" />
                        <span>{MOCK_DASHBOARD_STATS.passRateTrend}%</span>
                        <span className="ml-1 text-xs font-normal text-app-muted">{tDashboard.vsPrior7d}</span>
                      </div>
                    </div>

                    <svg
                      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                      preserveAspectRatio="none"
                      className="h-40 w-full"
                      role="img"
                      aria-label="Tendencia de aprobación de los últimos 7 días"
                    >
                      {[0, 25, 50, 75, 100].map((tick) => {
                        const y = yPosition(tick);
                        return (
                          <g key={tick}>
                            <line
                              x1={PLOT_LEFT}
                              x2={PLOT_RIGHT}
                              y1={y}
                              y2={y}
                              stroke="var(--color-app-border)"
                              strokeDasharray="3 4"
                              vectorEffect="non-scaling-stroke"
                            />
                            <text x={0} y={y + 3} fontSize={9} fill="var(--color-app-muted)">
                              {tick}%
                            </text>
                          </g>
                        );
                      })}

                      <path d={AREA_PATH} fill="color-mix(in oklch, var(--color-app-default) 7%, transparent)" />
                      <path
                        d={LINE_PATH}
                        fill="none"
                        stroke="var(--color-app-default)"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        vectorEffect="non-scaling-stroke"
                      />

                      {CHART_DATA.map((item, index) => (
                        <text
                          key={item.day}
                          x={xPosition(index)}
                          y={164}
                          textAnchor="middle"
                          fontSize={9}
                          fill="var(--color-app-muted)"
                        >
                          {item.day}
                        </text>
                      ))}
                    </svg>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.28fr)_minmax(21rem,0.72fr)]">
                <section
                  aria-label="Operational work queue"
                  className="flex h-full flex-col overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-xs"
                >
                  <div className="grid flex-1 grid-cols-1 divide-y divide-app-border md:grid-cols-2 md:divide-x md:divide-y-0">
                    <QueueSection title="Ejecuciones recientes">
                      {MOCK_DASHBOARD_RUNS.map((run) => (
                        <div key={run.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-app-canvas text-app-muted">
                              <Play size={15} weight="fill" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-app-default">{run.name}</p>
                              <p className="truncate text-xs text-app-muted">{run.suiteName}</p>
                            </div>
                          </div>
                          <StatusChip status={run.status} />
                        </div>
                      ))}
                    </QueueSection>

                    <QueueSection title="Pipelines recientes">
                      {MOCK_CI_PIPELINES.map((pipeline) => (
                        <div key={pipeline.id} className="flex min-h-14 items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-app-canvas text-app-muted">
                              <Code size={15} weight="bold" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-app-default">{pipeline.commitMessage}</p>
                              <p className="truncate font-mono text-xs text-app-muted">{pipeline.commitSha}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs tabular-nums text-app-muted">{pipeline.timeAgo}</span>
                        </div>
                      ))}
                    </QueueSection>
                  </div>
                </section>

                <section className="flex flex-col justify-between rounded-xl border border-app-border bg-app-surface p-5 shadow-xs md:p-6">
                  <div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-base font-semibold tracking-[-0.015em] text-app-default">
                            {tDashboard.pendingProposals}
                          </h2>
                          <span className="inline-flex shrink-0 items-center rounded-md border border-app-border bg-app-canvas px-2 py-0.5 text-xs font-medium text-app-muted">
                            {MOCK_AI_PROPOSALS.length} pendientes
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-app-muted">
                          Propuestas de prueba generadas por IA en espera de verificación humana
                        </p>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-app-default">
                        Bandeja de revisión
                        <CaretRight size={12} weight="bold" aria-hidden="true" />
                      </span>
                    </div>

                    <div className="mt-4 divide-y divide-app-border/60">
                      {MOCK_AI_PROPOSALS.map((proposal) => (
                        <div
                          key={proposal.id}
                          className="flex flex-col justify-between gap-3 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-app-ai-bg text-app-ai">
                              <Sparkle size={15} weight="fill" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold text-app-default">{proposal.title}</p>
                            </div>
                          </div>

                          <span className="inline-flex shrink-0 items-center gap-1 self-end rounded border border-app-border/80 bg-app-canvas/60 px-2.5 py-1.5 text-xs font-medium text-app-default sm:self-center">
                            Revisar
                            <CaretRight size={11} weight="bold" aria-hidden="true" />
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </div>

              <section className="rounded-xl border border-app-border bg-app-surface p-5 shadow-xs md:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.015em] text-app-default">
                      Riesgos de calidad y vigencia
                    </h2>
                    <p className="mt-0.5 text-xs text-app-muted">
                      Señales de pruebas desactualizadas, brechas de cobertura y estabilidad
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center rounded-md border border-app-border bg-app-canvas px-2.5 py-1 text-xs font-medium text-app-muted">
                    {MOCK_RISK_SIGNALS.length} señales activas
                  </span>
                </div>

                <div className="mt-4 divide-y divide-app-border/60">
                  {MOCK_RISK_SIGNALS.map((risk) => {
                    const severity = SEVERITY_PRESENTATION[risk.severity];

                    return (
                      <div
                        key={risk.id}
                        className="flex flex-col justify-between gap-3 py-3.5 first:pt-1 last:pb-0 sm:flex-row sm:items-center"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <WarningCircle
                            size={18}
                            weight="fill"
                            aria-hidden="true"
                            className={`mt-0.5 shrink-0 ${severity.color}`}
                          />
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold ${severity.badge}`}
                              >
                                {severity.label}
                              </span>
                              <span className="inline-flex items-center rounded border border-app-border bg-app-canvas px-2 py-0.5 text-[11px] font-medium text-app-muted">
                                {risk.projectName}
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] text-app-muted">
                                <FileText size={12} aria-hidden="true" />
                                <span>{risk.evidenceCount} evidencias</span>
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-app-default">{risk.criteria.join(' · ')}</p>
                          </div>
                        </div>

                        <div className="shrink-0 self-end sm:self-center">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-app-primary">
                            <span>Ver repositorio</span>
                            <ArrowSquareOut size={12} aria-hidden="true" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
