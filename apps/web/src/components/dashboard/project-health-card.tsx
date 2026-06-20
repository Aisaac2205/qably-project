import type { Project } from '@/lib/mock-data'

const statusLabel: Record<string, string> = {
  pass: 'Pass',
  fail: 'Fail',
  running: 'Running',
  pending: 'Pending',
}

export function ProjectHealthCard({ project }: { project: Project }) {
  const { name, healthScore, lastRunStatus } = project
  const passWidth = `${healthScore}%`
  const failWidth = `${Math.max(0, 100 - healthScore)}%`

  const statusChipClass =
    lastRunStatus === 'pass' ? 'bg-pass-bg text-pass' :
    lastRunStatus === 'fail' ? 'bg-fail-bg text-fail' :
    lastRunStatus === 'running' ? 'bg-running-bg text-running' :
    'bg-skip-bg text-skip'

  return (
    <div className="bg-surface rounded-md p-3 cursor-pointer hover:border-primary border border-border transition-colors">
      <div className="text-sm font-semibold text-default truncate mb-2">{name}</div>

      <div data-testid="health-bar" className="h-1 rounded-full flex overflow-hidden bg-canvas mb-2">
        <div className="bg-pass rounded-full" style={{ width: passWidth }} />
        <div className="bg-fail" style={{ width: failWidth }} />
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${statusChipClass}`}>
          {statusLabel[lastRunStatus] ?? lastRunStatus}
        </span>
        <span className="text-[10px] text-muted">{healthScore}%</span>
      </div>
    </div>
  )
}
