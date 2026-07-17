'use client'

import Link from 'next/link'
import { Play, Sparkle, Code } from '@phosphor-icons/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusChip } from '@/components/ui/status-chip'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { formatRelativeTime } from '@/features/dashboard/lib/format'
import { useTranslation } from '@/lib/i18n'

function getCasePriority(name: string): { label: string; className: string } {
  if (name.toLowerCase().includes('login') || name.toLowerCase().includes('critical')) {
    return { label: 'High', className: 'bg-fail-bg text-fail border border-fail/10' }
  }
  return { label: 'Medium', className: 'bg-warn-bg text-warn border border-warn/10' }
}

export function RecentActivity() {
  const stats = useDashboardStats()
  const { t } = useTranslation()

  const runs = stats.recentRuns.slice(0, 4)
  const aiCases = stats.recentAiCases.slice(0, 3)
  const ciRuns = stats.recentCiRuns.slice(0, 3)

  return (
    <>
      <Card className="border border-border/80 flex flex-col justify-between">
        <CardHeader className="flex flex-row items-center justify-between pb-3 p-5">
          <CardTitle className="text-sm font-semibold text-default">{t('dashboard.recentRuns')}</CardTitle>
          <Link
            href="/projects"
            className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-all duration-150 cursor-pointer"
          >
            {t('common.viewAll')}
          </Link>
        </CardHeader>
        
        <CardContent className="p-0 flex-1">
          {runs.length === 0 ? (
            <p className="text-xs text-muted-foreground p-5">{t('dashboard.noRuns')}</p>
          ) : (
            <div className="divide-y divide-border/60">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-3 py-3.5 px-5 hover:bg-canvas/20 transition-colors duration-150 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-zinc-500/10 text-muted-foreground flex items-center justify-center shrink-0">
                      <Play size={14} className="group-hover:text-primary transition-colors" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-default truncate">{run.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{run.suiteName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums font-mono">
                      {formatRelativeTime(run.startedAt)}
                    </span>
                    <StatusChip status={run.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/80 flex flex-col justify-between">
        <CardHeader className="flex flex-row items-center justify-between pb-3 p-5">
          <CardTitle className="text-sm font-semibold text-default">{t('dashboard.pendingAiCases')}</CardTitle>
          <Link
            href="/projects"
            className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-all duration-150 cursor-pointer"
          >
            {t('common.viewAll')}
          </Link>
        </CardHeader>
        
        <CardContent className="p-0 flex-1">
          {aiCases.length === 0 ? (
            <p className="text-xs text-muted-foreground p-5">{t('dashboard.noPendingAi')}</p>
          ) : (
            <div className="divide-y divide-border/60">
              {aiCases.map((c) => {
                const prio = getCasePriority(c.name)
                return (
                  <div 
                    key={c.id} 
                    className="flex items-center justify-between gap-3 py-3.5 px-5 hover:bg-canvas/20 transition-colors duration-150 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                        <Sparkle size={14} className="group-hover:animate-pulse" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-default truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {c.sourceFile}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${prio.className}`}>
                      {prio.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border/80 flex flex-col justify-between">
        <CardHeader className="flex flex-row items-center justify-between pb-3 p-5">
          <CardTitle className="text-sm font-semibold text-default">{t('dashboard.recentPipelines')}</CardTitle>
          <Link
            href="/projects"
            className="text-xs font-semibold text-primary hover:text-primary-hover hover:underline transition-all duration-150 cursor-pointer"
          >
            {t('common.viewAll')}
          </Link>
        </CardHeader>
        
        <CardContent className="p-0 flex-1">
          {ciRuns.length === 0 ? (
            <p className="text-xs text-muted-foreground p-5">{t('dashboard.noPipelines')}</p>
          ) : (
            <div className="divide-y divide-border/60">
              {ciRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-3 py-3.5 px-5 hover:bg-canvas/20 transition-colors duration-150 cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-zinc-500/10 text-muted-foreground flex items-center justify-center shrink-0">
                      <Code size={14} className="group-hover:text-primary transition-colors" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-default truncate">
                        {run.commitMessage ?? run.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {run.commitSha && <span className="font-mono">{run.commitSha}</span>}
                        {(run.commitSha && run.branch) && ' · '}
                        {run.branch && <span className="font-medium text-default/80">{run.branch}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums font-mono">
                      {formatRelativeTime(run.startedAt)}
                    </span>
                    <StatusChip status={run.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
