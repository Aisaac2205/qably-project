import type { AiCase, ReviewStatus } from '@/lib/mock-data'

const STATUS_CONFIG: Record<ReviewStatus, { label: string; className: string }> = {
  pending:   { label: '· Pending',   className: 'text-muted' },
  confirmed: { label: '✓ Confirmed', className: 'text-pass font-bold' },
  rejected:  { label: '✗ Rejected',  className: 'text-fail font-bold' },
}

interface ReviewCaseListProps {
  cases: AiCase[]
  activeId: string
  onSelect: (id: string) => void
}

export function ReviewCaseList({ cases, activeId, onSelect }: ReviewCaseListProps) {
  const pendingCount = cases.filter(c => c.reviewStatus === 'pending').length

  return (
    <div className="w-[35%] min-w-[140px] border-r border-border bg-surface flex flex-col overflow-hidden">
      <div className="flex justify-between items-center px-2 py-1.5 border-b border-border">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted">Pending</span>
        <span className="text-[9px] font-bold text-ai">{pendingCount}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {cases.map(c => {
          const st = STATUS_CONFIG[c.reviewStatus]
          const isActive = c.id === activeId
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={[
                'w-full text-left px-2 py-1.5 border-b border-canvas transition-colors',
                isActive ? 'bg-canvas border-l-2 border-l-ai' : 'hover:bg-canvas/50',
              ].join(' ')}
            >
              <div className={`text-[10px] font-medium leading-tight mb-1 ${isActive ? 'text-ai' : 'text-default'}`}>
                {c.name}
              </div>
              <span className={`text-[9px] ${st.className}`}>{st.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
