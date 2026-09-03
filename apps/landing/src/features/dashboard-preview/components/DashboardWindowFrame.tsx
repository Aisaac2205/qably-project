import React, { useState } from 'react';
import {
  SquaresFour,
  FolderSimple,
  Tray,
  BellSimple,
  GearSix,
  Play,
  ChartBar,
  Sparkle,
  Target,
  CalendarBlank,
  CaretUpDown,
  CaretRight,
  SidebarSimple,
  LockSimple,
  MagnifyingGlass,
  CheckCircle,
  XCircle,
} from '@phosphor-icons/react';
import { RealTraceabilityCalendar } from './RealTraceabilityCalendar';
import { MOCK_PROJECTS, MOCK_DASHBOARD_STATS, MOCK_RECENT_RUNS, MOCK_AI_PROPOSALS } from '../data/mock-dashboard-data';
import type { DashboardTranslations, HeroTranslations } from '../../i18n/types';

interface DashboardWindowFrameProps {
  tDashboard: DashboardTranslations;
  tHero: HeroTranslations;
}

type NavSection = 'dashboard' | 'projects' | 'inbox' | 'notifications' | 'settings';

export function DashboardWindowFrame({ tDashboard }: DashboardWindowFrameProps) {
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-zinc-300/90 bg-white shadow-[0_25px_80px_rgba(0,0,0,0.85)] flex flex-col text-zinc-900 font-sans">
      {/* macOS Authentic White / Light Window Titlebar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#fbfbfb] border-b border-zinc-200/80 select-none">
        <div className="flex items-center gap-2">
          {/* Authentic Mac Traffic Light Dots */}
          <div className="size-3 rounded-full bg-[#ff5f56] border border-[#e0443e]/80 shadow-[0_0_4px_rgba(255,95,86,0.3)] transition-transform hover:scale-110 cursor-pointer" title="Cerrar" />
          <div className="size-3 rounded-full bg-[#ffbd2e] border border-[#dea123]/80 shadow-[0_0_4px_rgba(255,189,46,0.3)] transition-transform hover:scale-110 cursor-pointer" title="Minimizar" />
          <div className="size-3 rounded-full bg-[#27c93f] border border-[#1aab29]/80 shadow-[0_0_4px_rgba(39,201,63,0.3)] transition-transform hover:scale-110 cursor-pointer" title="Expandir" />
        </div>

        {/* Real Official Route Badge in URL bar */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-zinc-100/90 border border-zinc-200/70 text-xs text-zinc-600 font-mono shadow-2xs">
          <LockSimple size={12} weight="bold" className="text-zinc-500" />
          <span className="select-none font-sans font-medium text-[11px] text-zinc-700">qably.dev/dashboard</span>
        </div>

        {/* Live Sync Dot Indicator */}
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-sans">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="hidden sm:inline font-medium text-zinc-600">Live</span>
        </div>
      </div>

      {/* Main Window Body: 100% Identical Replica of apps/web (Light Theme) */}
      <div className="grid grid-cols-1 md:grid-cols-[224px_1fr] min-h-[660px] text-zinc-900 font-sans bg-white">
          {/* Left Sidebar (Exact replica of apps/web sidebar) */}
          <aside className="hidden md:flex flex-col justify-between border-r border-zinc-200/80 bg-white p-3.5 select-none text-left">
            <div className="space-y-4">
              {/* Sidebar Brand Header with Collapse Button */}
              <div className="flex items-center justify-between px-1 py-1">
                <a href="/dashboard" aria-label="Qably Home" className="flex items-center">
                  <img
                    src="/qably-sidebar.svg"
                    alt="Qably"
                    className="h-6 w-auto object-contain"
                  />
                </a>
                <button
                  type="button"
                  aria-label="Toggle sidebar"
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors border border-zinc-200/60 cursor-pointer"
                >
                  <SidebarSimple size={15} />
                </button>
              </div>

              {/* Sidebar Navigation Items */}
              <nav className="space-y-1" aria-label="Sidebar preview">
                <button
                  type="button"
                  onClick={() => setActiveNav('dashboard')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeNav === 'dashboard'
                      ? 'bg-zinc-100 text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <SquaresFour size={16} weight={activeNav === 'dashboard' ? 'bold' : 'regular'} />
                  <span>Dashboard</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveNav('projects')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeNav === 'projects'
                      ? 'bg-zinc-100 text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <FolderSimple size={16} />
                  <span>Proyectos</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveNav('inbox')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeNav === 'inbox'
                      ? 'bg-zinc-100 text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Tray size={16} />
                    <span>Bandeja de revisión</span>
                  </div>
                  <span className="rounded bg-zinc-200 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-800">
                    3
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveNav('notifications')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeNav === 'notifications'
                      ? 'bg-zinc-100 text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <BellSimple size={16} />
                  <span>Notificaciones</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveNav('settings')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    activeNav === 'settings'
                      ? 'bg-zinc-100 text-zinc-900 shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  <GearSix size={16} />
                  <span>Configuración</span>
                </button>
              </nav>
            </div>

            {/* Sidebar Footer User Card (Exact SidebarAccount from apps/web) */}
            <div className="border border-zinc-200/80 rounded-xl p-2 bg-white flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-7 rounded-full bg-black text-white text-xs font-bold flex items-center justify-center shrink-0 select-none">
                  IF
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="text-xs font-semibold text-zinc-900 truncate">Isaac F.</span>
                  <span className="text-[10px] text-zinc-500">Administrador</span>
                </div>
              </div>
              <CaretUpDown size={14} className="text-zinc-400 shrink-0" />
            </div>
          </aside>

          {/* Right Content Area */}
          <div className="flex flex-col bg-[#f8f9fa] overflow-hidden text-left">
            {/* Top Bar (Exact replica of apps/web top-bar.tsx) */}
            <div className="h-14 bg-white border-b border-zinc-200/80 px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <h1 className="text-base sm:text-lg font-semibold tracking-[-0.015em] text-zinc-900 font-sans">
                  Dashboard
                </h1>
              </div>

              {/* Right Tools: Search box, Notification Bell with badge & User Avatar */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-50 border border-zinc-200 text-xs text-zinc-500 w-52">
                  <MagnifyingGlass size={13} />
                  <span className="truncate">Buscar proyectos, runs...</span>
                  <kbd className="ml-auto text-[10px] bg-zinc-200/80 px-1 py-0.2 rounded text-zinc-600 font-mono">⌘K</kbd>
                </div>

                <div className="relative p-1.5 text-zinc-600 hover:text-zinc-900 rounded-md cursor-pointer">
                  <BellSimple size={18} />
                  <span className="absolute top-0.5 right-0.5 size-3.5 bg-rose-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                    2
                  </span>
                </div>

                <div className="size-7 select-none rounded-full bg-black text-white font-bold text-xs flex items-center justify-center">
                  IF
                </div>
              </div>
            </div>

            {/* Main Dashboard Workspace (Rich Mock Data) */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
              {/* 1. KpiRow: 4 Cards with Rich Mock Data */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Ejecuciones */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-medium">Ejecuciones • 7 días</span>
                    <div className="size-6 rounded-md border border-zinc-200/80 flex items-center justify-center text-zinc-500 bg-zinc-50">
                      <Play size={12} weight="bold" />
                    </div>
                  </div>
                  <div className="my-2.5">
                    <span className="text-3xl font-semibold text-zinc-900 tracking-tight tabular-nums">
                      {MOCK_DASHBOARD_STATS.runsLast7d}
                    </span>
                  </div>
                  <div className="border-t border-zinc-100 pt-2 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Ver detalles</span>
                    <CaretRight size={11} />
                  </div>
                </div>

                {/* Card 2: Aprobación */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-medium">Aprobación • 7 días</span>
                    <div className="size-6 rounded-md border border-zinc-200/80 flex items-center justify-center text-zinc-500 bg-zinc-50">
                      <ChartBar size={12} />
                    </div>
                  </div>
                  <div className="my-2.5">
                    <span className="text-3xl font-semibold text-zinc-900 tracking-tight tabular-nums">
                      {MOCK_DASHBOARD_STATS.passRateLast7d}.4%
                    </span>
                  </div>
                  <div className="border-t border-zinc-100 pt-2 flex items-center justify-between text-[11px] text-zinc-500">
                    <span className="text-emerald-600 font-semibold">↑ +5% vs. los 7 días anteriores</span>
                    <CaretRight size={11} />
                  </div>
                </div>

                {/* Card 3: IA pendiente */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-medium">IA pendiente</span>
                    <div className="size-6 rounded-md border border-zinc-200/80 flex items-center justify-center text-zinc-500 bg-zinc-50">
                      <Sparkle size={12} />
                    </div>
                  </div>
                  <div className="my-2.5">
                    <span className="text-3xl font-semibold text-zinc-900 tracking-tight tabular-nums">
                      {MOCK_DASHBOARD_STATS.pendingProposals}
                    </span>
                  </div>
                  <div className="border-t border-zinc-100 pt-2 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Ver detalles</span>
                    <CaretRight size={11} />
                  </div>
                </div>

                {/* Card 4: Brechas de cobertura */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 font-medium">Brechas de cobertura</span>
                    <div className="size-6 rounded-md border border-zinc-200/80 flex items-center justify-center text-zinc-500 bg-zinc-50">
                      <Target size={12} />
                    </div>
                  </div>
                  <div className="my-2.5">
                    <span className="text-3xl font-semibold text-zinc-900 tracking-tight tabular-nums">
                      {MOCK_DASHBOARD_STATS.coverageGapsCount}
                    </span>
                  </div>
                  <div className="border-t border-zinc-100 pt-2 flex items-center justify-between text-[11px] text-zinc-400">
                    <span>Ver detalles</span>
                    <CaretRight size={11} />
                  </div>
                </div>
              </div>

              {/* 2. Trazabilidad Section (Contribution Calendar Heatmap) */}
              <div className="bg-white rounded-xl border border-zinc-200/80 p-5 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 tracking-[-0.015em]">
                      Trazabilidad
                    </h2>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Trazabilidad en vivo entre repositorios, propuestas, casos oficiales y ejecuciones
                    </p>
                    <a
                      href="#features"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 hover:text-black mt-1.5 transition-colors"
                    >
                      <span>Bandeja de revisión</span>
                      <CaretRight size={11} weight="bold" />
                    </a>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2 border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-xs text-zinc-700 shadow-2xs">
                      <CalendarBlank size={14} className="text-zinc-500" />
                      <span>Todas las etapas</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-600">
                        922
                      </span>
                      <CaretUpDown size={12} className="text-zinc-400 ml-1" />
                    </div>

                    <div className="flex items-center gap-1.5 border border-zinc-200 rounded-lg px-2.5 py-1.5 bg-white text-xs text-zinc-700 shadow-2xs">
                      <span>2026</span>
                      <CaretUpDown size={12} className="text-zinc-400" />
                    </div>
                  </div>
                </div>

                {/* Heatmap Matrix SVG */}
                <RealTraceabilityCalendar />
              </div>

              {/* 3. Middle Grid: Salud de proyectos + Tendencia de aprobación */}
              <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
                {/* Salud de proyectos with Rich Mock Projects */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-5 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <h3 className="text-sm font-semibold text-zinc-900">Salud de proyectos</h3>
                    <span className="text-xs text-zinc-500 hover:text-zinc-900 cursor-pointer font-medium">
                      Ver todo
                    </span>
                  </div>

                  <div className="overflow-x-auto my-2">
                    <table className="w-full text-left text-xs font-sans">
                      <thead>
                        <tr className="text-zinc-400 border-b border-zinc-100 text-[11px]">
                          <th className="pb-2.5 font-medium">Proyecto</th>
                          <th className="pb-2.5 font-medium">Salud</th>
                          <th className="pb-2.5 font-medium">Última ejecución</th>
                          <th className="pb-2.5 font-medium text-center">Suites</th>
                          <th className="pb-2.5 font-medium text-center">IA pendiente</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {MOCK_PROJECTS.map((project) => (
                          <tr key={project.id} className="hover:bg-zinc-50/60 transition-colors">
                            <td className="py-3 font-semibold text-zinc-900">
                              <div>{project.name}</div>
                              <div className="text-[10px] text-zinc-400 font-normal">{project.technologies.join(' • ')}</div>
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`size-2 rounded-full ${
                                    project.healthScore >= 80
                                      ? 'bg-emerald-500'
                                      : project.healthScore >= 60
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                  }`}
                                />
                                <span className="font-semibold text-zinc-800 tabular-nums">{project.healthScore}%</span>
                              </div>
                            </td>
                            <td className="py-3 text-zinc-500">{project.lastRunAt}</td>
                            <td className="py-3 text-center text-zinc-600 font-mono font-medium">{project.suiteCount}</td>
                            <td className="py-3 text-center">
                              {project.aiPendingCount > 0 ? (
                                <span className="rounded bg-zinc-100 border border-zinc-200 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-800">
                                  +{project.aiPendingCount}
                                </span>
                              ) : (
                                <span className="text-zinc-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Tendencia de aprobación with Smooth SVG Chart */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-5 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                    <h3 className="text-sm font-semibold text-zinc-900">Tendencia de aprobación</h3>
                    <div className="flex items-center gap-1 border border-zinc-200 rounded px-2 py-0.5 text-xs text-zinc-600">
                      <span>7 days</span>
                      <CaretUpDown size={10} />
                    </div>
                  </div>

                  <div className="my-2">
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-semibold text-zinc-900 tabular-nums">89.4%</span>
                      <span className="text-xs font-semibold text-emerald-600">↑ 8% vs. los 7 días anteriores</span>
                    </div>

                    {/* Chart SVG */}
                    <div className="w-full h-32">
                      <svg viewBox="0 0 400 130" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="landingTrendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="20" x2="400" y2="20" stroke="#f4f4f5" strokeDasharray="3 3" />
                        <line x1="0" y1="50" x2="400" y2="50" stroke="#f4f4f5" strokeDasharray="3 3" />
                        <line x1="0" y1="80" x2="400" y2="80" stroke="#f4f4f5" strokeDasharray="3 3" />
                        <line x1="0" y1="110" x2="400" y2="110" stroke="#f4f4f5" />
                        
                        {/* Trend area and stroke */}
                        <path
                          d="M 0 85 L 60 72 L 120 78 L 180 65 L 240 58 L 300 62 L 360 52 L 400 50 L 400 120 L 0 120 Z"
                          fill="url(#landingTrendFill)"
                        />
                        <path
                          d="M 0 85 L 60 72 L 120 78 L 180 65 L 240 58 L 300 62 L 360 52 L 400 50"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                        />
                        <circle cx="400" cy="50" r="3.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                      </svg>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-400 pt-1 font-mono">
                      <span>May 8</span>
                      <span>May 9</span>
                      <span>May 10</span>
                      <span>May 11</span>
                      <span>May 12</span>
                      <span>May 13</span>
                      <span>May 14</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Bottom Cards: Ejecuciones recientes, Pipelines recientes, Propuestas pendientes */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Ejecuciones recientes */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
                    <h4 className="text-xs font-semibold text-zinc-900">Ejecuciones recientes</h4>
                    <span className="text-[11px] text-zinc-500 font-medium cursor-pointer">View all &gt;</span>
                  </div>
                  <div className="space-y-2.5">
                    {MOCK_RECENT_RUNS.slice(0, 2).map((run) => (
                      <div key={run.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          {run.status === 'pass' ? (
                            <CheckCircle size={15} weight="fill" className="text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle size={15} weight="fill" className="text-rose-500 shrink-0" />
                          )}
                          <span className="text-zinc-800 font-medium truncate">{run.title}</span>
                        </div>
                        <span className="text-zinc-400 text-[11px] shrink-0">{run.timeAgo}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pipelines recientes */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
                    <h4 className="text-xs font-semibold text-zinc-900">Pipelines recientes</h4>
                    <span className="text-[11px] text-zinc-500 font-medium cursor-pointer">View all &gt;</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle size={15} weight="fill" className="text-emerald-500 shrink-0" />
                        <span className="text-zinc-800 font-medium truncate">Main CI/CD Quality Gate</span>
                      </div>
                      <span className="text-zinc-400 text-[11px] shrink-0">4m ago</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle size={15} weight="fill" className="text-emerald-500 shrink-0" />
                        <span className="text-zinc-800 font-medium truncate">Nightly E2E Regression</span>
                      </div>
                      <span className="text-zinc-400 text-[11px] shrink-0">2h ago</span>
                    </div>
                  </div>
                </div>

                {/* Propuestas pendientes */}
                <div className="bg-white rounded-xl border border-zinc-200/80 p-4 shadow-2xs flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-3 border-b border-zinc-100 mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-zinc-900">Propuestas pendientes</h4>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-700">
                        3 pendientes
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-medium cursor-pointer">Bandeja de revisión &gt;</span>
                  </div>
                  <div className="space-y-2.5">
                    {MOCK_AI_PROPOSALS.slice(0, 2).map((proposal) => (
                      <div key={proposal.id} className="flex items-center justify-between text-xs">
                        <span className="text-zinc-800 font-medium truncate">{proposal.title}</span>
                        <span className="rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-semibold shrink-0">
                          {proposal.confidence}% conf
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
