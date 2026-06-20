import type { TestCase } from '@/lib/mock-data'
import { StatusChip } from './status-chip'

interface CaseListProps {
  cases: TestCase[]
  activeId: string
  onSelect: (id: string) => void
}

export function CaseList({ cases, activeId, onSelect }: CaseListProps) {
  return (
    <div className="w-[35%] min-w-[140px] border-r border-border bg-surface flex flex-col overflow-hidden">
      <div className="flex justify-between items-center px-2 py-1.5 border-b border-border">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted">Cases</span>
        <span className="text-[9px] text-muted">{cases.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {cases.map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={[
              'w-full text-left px-2 py-1.5 border-b border-canvas transition-colors',
              activeId === c.id
                ? 'bg-canvas border-l-2 border-l-primary'
                : 'hover:bg-canvas/50',
            ].join(' ')}
          >
            <div className={`text-[10px] font-medium leading-tight mb-1 ${activeId === c.id ? 'text-primary' : 'text-default'}`}>
              {c.name}
            </div>
            <StatusChip status={c.status} />
          </button>
        ))}
      </div>
    </div>
  )
}
