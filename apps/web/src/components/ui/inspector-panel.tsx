import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface InspectorPanelProps {
  title: ReactNode
  children: ReactNode
  className?: string
}

export function InspectorPanel({ title, children, className }: InspectorPanelProps) {
  const titleId = useId()

  return (
    <aside aria-labelledby={titleId} className={cn('overflow-hidden rounded-lg border border-border bg-surface', className)}>
      <div className="border-b border-border px-5 py-4">
        <h2 id={titleId} className="text-sm font-semibold text-default">{title}</h2>
      </div>
      {children}
    </aside>
  )
}
