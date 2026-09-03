import React from 'react';
import {
  SquaresFour,
  FolderSimple,
  Tray,
  GearSix,
  Play,
  ChartBar,
  Sparkle,
  Target,
  BellSimple,
  CheckCircle,
} from '@phosphor-icons/react';
import { Iphone16Pro } from '@/components/ui/iphone-16-pro';
import { MOCK_DASHBOARD_STATS, MOCK_DEMO_USER, MOCK_PROJECTS, MOCK_RECENT_RUNS } from '@/features/dashboard-preview/data/mock-dashboard-data';
import type { DashboardTranslations } from '@/features/i18n/types';

interface MobileDashboardIphoneProps {
  tDashboard?: DashboardTranslations;
}

export function MobileDashboardIphone({ tDashboard }: MobileDashboardIphoneProps) {
  return (
    <div className="relative mx-auto flex justify-center py-4 select-none">
      {/* Container matching iPhone 16 Pro aspect ratio (200 x 400 => 320px x 640px) */}
      <div className="relative w-[300px] sm:w-[330px] aspect-[200/400] drop-shadow-[0_25px_60px_rgba(0,0,0,0.85)]">
        {/* Device Frame SVG */}
        <Iphone16Pro className="absolute inset-0 size-full pointer-events-none z-20" />

        {/* Inner Screen Content - Placed exactly inside the iPhone 16 Pro screen viewport */}
        <div
          className="absolute z-10 overflow-hidden bg-[#f8f9fa] text-zinc-900 font-sans flex flex-col justify-between"
          style={{
            left: '7.04%',
            top: '3.2%',
            width: '85.99%',
            height: '93.59%',
            borderRadius: '24.62px',
          }}
        >
          {/* Top Status Bar Spacer (Dynamic Island sits here at z-20) */}
          <div className="h-10 shrink-0 bg-white/80 backdrop-blur-sm flex items-center justify-between px-5 pt-2 text-[10px] font-semibold text-zinc-800">
            <span>9:41</span>
            <div className="flex items-center gap-1 text-[10px]">
              <span>5G</span>
              <div className="w-4 h-2 border border-zinc-800 rounded-xs p-0.5 flex">
                <div className="w-2.5 h-full bg-zinc-800 rounded-2xs" />
              </div>
            </div>
          </div>

          {/* Mobile App Header */}
          <div className="h-11 bg-white border-b border-zinc-200/80 px-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <img
                src="/qably-sidebar.svg"
                alt="Qably"
                className="h-4 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="relative p-1 text-zinc-600">
                <BellSimple size={15} />
                <span className="absolute top-0 right-0 size-2 bg-rose-500 rounded-full" />
              </div>
              <div className="size-5 rounded-full bg-black text-white font-bold text-[9px] flex items-center justify-center">
                {MOCK_DEMO_USER.initials}
              </div>
            </div>
          </div>

          {/* Scrollable Dashboard Body */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 text-left scrollbar-none">
            {/* Title */}
            <div className="flex items-center justify-between px-0.5">
              <h3 className="text-xs font-bold text-zinc-900">Dashboard</h3>
              <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                ● Live CI/CD
              </span>
            </div>

            {/* Compact 2x2 KPI Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {/* Runs */}
              <div className="bg-white rounded-lg border border-zinc-200/80 p-2 shadow-2xs">
                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-medium">
                  <span>Runs (7d)</span>
                  <Play size={10} className="text-zinc-400" />
                </div>
                <div className="text-base font-bold text-zinc-900 mt-1">
                  {MOCK_DASHBOARD_STATS.runsLast7d}
                </div>
                <div className="text-[8px] text-zinc-400">Ver detalles &gt;</div>
              </div>

              {/* Pass Rate */}
              <div className="bg-white rounded-lg border border-zinc-200/80 p-2 shadow-2xs">
                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-medium">
                  <span>Aprobación</span>
                  <ChartBar size={10} className="text-zinc-400" />
                </div>
                <div className="text-base font-bold text-zinc-900 mt-1">
                  89.4%
                </div>
                <div className="text-[8px] text-emerald-600 font-semibold">↑ +5%</div>
              </div>

              {/* AI Pending */}
              <div className="bg-white rounded-lg border border-zinc-200/80 p-2 shadow-2xs">
                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-medium">
                  <span>IA Pendiente</span>
                  <Sparkle size={10} className="text-zinc-400" />
                </div>
                <div className="text-base font-bold text-zinc-900 mt-1">
                  {MOCK_DASHBOARD_STATS.pendingProposals}
                </div>
                <div className="text-[8px] text-zinc-400">En revisión</div>
              </div>

              {/* Coverage Gaps */}
              <div className="bg-white rounded-lg border border-zinc-200/80 p-2 shadow-2xs">
                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-medium">
                  <span>Brechas</span>
                  <Target size={10} className="text-zinc-400" />
                </div>
                <div className="text-base font-bold text-zinc-900 mt-1">
                  {MOCK_DASHBOARD_STATS.coverageGapsCount}
                </div>
                <div className="text-[8px] text-zinc-400">Requerimientos</div>
              </div>
            </div>

            {/* Project Health Card */}
            <div className="bg-white rounded-lg border border-zinc-200/80 p-2.5 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-900">
                <span>Salud de Proyectos</span>
                <span className="text-[9px] text-zinc-400 font-normal">Ver todo</span>
              </div>
              <div className="space-y-1.5">
                {MOCK_PROJECTS.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-[9px]">
                    <span className="font-semibold text-zinc-800 truncate max-w-[110px]">{p.name}</span>
                    <div className="flex items-center gap-1 font-semibold">
                      <span
                        className={`size-1.5 rounded-full ${
                          p.healthScore >= 80 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                      />
                      <span className="text-zinc-700">{p.healthScore}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Executions */}
            <div className="bg-white rounded-lg border border-zinc-200/80 p-2.5 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-900">
                <span>Ejecuciones Recientes</span>
                <span className="text-[9px] text-zinc-400 font-normal">Runs &gt;</span>
              </div>
              <div className="space-y-1.5">
                {MOCK_RECENT_RUNS.slice(0, 2).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-[9px]">
                    <div className="flex items-center gap-1 truncate max-w-[130px]">
                      <CheckCircle size={11} weight="fill" className="text-emerald-500 shrink-0" />
                      <span className="truncate text-zinc-700 font-medium">{r.title}</span>
                    </div>
                    <span className="text-zinc-400 shrink-0 text-[8px]">{r.timeAgo}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Mobile Bottom Tab Bar */}
          <div className="h-10 bg-white border-t border-zinc-200/80 px-4 flex items-center justify-around shrink-0 text-zinc-500">
            <div className="flex flex-col items-center gap-0.5 text-zinc-900">
              <SquaresFour size={14} weight="bold" />
              <span className="text-[8px] font-semibold">Inicio</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <FolderSimple size={14} />
              <span className="text-[8px]">Proyectos</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 relative">
              <Tray size={14} />
              <span className="text-[8px]">Inbox</span>
              <span className="absolute -top-1 right-1 size-1.5 bg-rose-500 rounded-full" />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <GearSix size={14} />
              <span className="text-[8px]">Ajustes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
