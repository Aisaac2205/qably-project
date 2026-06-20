import type { CaseStatus } from '@/lib/mock-data'

const STATUS_CONFIG: Record<CaseStatus, { label: string; icon: string; className: string }> = {
  pass:    { label: 'Pass',    icon: '✓', className: 'bg-pass-bg text-pass' },
  fail:    { label: 'Fail',    icon: '✗', className: 'bg-fail-bg text-fail' },
  skip:    { label: 'Skip',    icon: '◌', className: 'bg-skip-bg text-skip' },
  blocked: { label: 'Blocked', icon: '⊘', className: 'bg-blocked-bg text-blocked' },
  running: { label: 'Running', icon: '●', className: 'bg-running-bg text-running' },
  pending: { label: 'Pending', icon: '—', className: 'bg-skip-bg text-muted' },
}

export function StatusChip({ status }: { status: CaseStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${config.className}`}>
      <span aria-hidden="true">{config.icon}</span>
      {config.label}
    </span>
  )
}
