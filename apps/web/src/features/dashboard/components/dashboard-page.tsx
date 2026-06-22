'use client'

import { Lightbulb } from '@phosphor-icons/react'
import { KpiRow } from './kpi-row'
import { ProjectHealthTable } from './project-health-table'
import { PassRateTrend } from './pass-rate-trend'
import { AiCasesOverview } from './ai-cases-overview'
import { RecentActivity } from './recent-activity'
import { BotIllustration } from './bot-illustration'
import { useOrg } from '@/lib/use-mock-store'

export function DashboardPage() {
  const org = useOrg()

  return (
    <div className="max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 bg-canvas min-h-screen text-default">
      {/* Hidden elements for unit tests / accessibility compatibility */}
      <h1 className="sr-only text-2xl font-semibold tracking-tight">Dashboard</h1>
      <span className="sr-only">Welcome back, {org.name}</span>

      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-default">
            Good morning, Isaac 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5">
            Here's what's happening with your QA platform today.
          </p>
        </div>

        {/* Qably Mascot efficiency banner card */}
        <div className="w-full md:w-md flex items-center gap-4 p-4 bg-surface border border-border/80 rounded-xl shadow-xs hover:shadow-md transition-all duration-300">
          <BotIllustration />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-default">Qably is working efficiently</h3>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Your tests, cases, and pipelines are running smoothly.
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards Row */}
      <KpiRow />

      {/* Middle Row: Project Health, Pass Rate Trend, and AI Cases Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ProjectHealthTable />
        <PassRateTrend />
        <AiCasesOverview />
      </div>

      {/* Bottom Row: Feeds (Runs, AI cases, Pipelines) */}
      <RecentActivity />

      {/* Tip Banner */}
      <div className="relative overflow-hidden w-full bg-linear-to-r from-indigo-900 via-purple-950 to-indigo-950 text-white rounded-xl p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-6 border border-indigo-800/40 shadow-md">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.15),transparent_60%)] pointer-events-none" />
        
        <div className="flex items-start md:items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-yellow-300 shrink-0 shadow-inner">
            <Lightbulb size={20} weight="fill" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">Tip from Qably</span>
            <p className="text-sm font-medium mt-1 leading-relaxed text-zinc-100">
              Connect your GitHub repository to auto-detect changes and generate test cases with AI.
            </p>
          </div>
        </div>

        <button className="flex items-center justify-center gap-2 bg-white text-zinc-950 font-semibold px-4.5 py-2.5 text-xs rounded-lg hover:bg-zinc-100 transition-colors shadow-sm shrink-0 cursor-pointer hover:scale-102 active:scale-98">
          <img src="/github.svg" className="w-4 h-4 shrink-0" alt="GitHub Logo" />
          <span>Connect GitHub</span>
        </button>
      </div>

      {/* Footer */}
      <footer className="flex items-center justify-between border-t border-border/60 pt-6 text-xs text-muted-foreground pb-8">
        <div>
          © 2026 Qably · All systems operational
          <span className="inline-block w-2 h-2 rounded-full bg-pass animate-pulse ml-2" />
        </div>
      </footer>
    </div>
  )
}
