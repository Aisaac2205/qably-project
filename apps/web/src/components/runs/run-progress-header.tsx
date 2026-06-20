import type { TestCase } from '@/lib/mock-data'

export function RunProgressHeader({ cases }: { cases: TestCase[] }) {
  const total = cases.length
  const passed = cases.filter(c => c.status === 'pass').length
  const failed = cases.filter(c => c.status === 'fail').length
  const skipped = cases.filter(c => c.status === 'skip').length
  const done = passed + failed + skipped
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-surface border-b border-border h-8 shrink-0">
      <div className="flex-1 h-1.5 bg-canvas rounded-full flex overflow-hidden">
        <div className="bg-pass rounded-full" style={{ width: `${(passed / total) * 100}%` }} />
        <div className="bg-fail" style={{ width: `${(failed / total) * 100}%` }} />
        <div className="bg-skip" style={{ width: `${(skipped / total) * 100}%` }} />
      </div>
      <span className="text-xs font-semibold text-default tabular-nums">{done}/{total}</span>
      <span className="text-xs text-muted tabular-nums">{passRate}% pass</span>
    </div>
  )
}
