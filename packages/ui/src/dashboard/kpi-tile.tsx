import type { ReactNode } from 'react'
import { cn } from '../utils'

export type KpiDeltaTone = 'better' | 'worse' | 'neutral'

export interface KpiTileDelta {
  text: string
  tone: KpiDeltaTone
  srText: string
}

export interface KpiTileProps {
  label: string
  value: string | number
  delta?: KpiTileDelta
  className?: string
  children?: ReactNode
}

const DELTA_TONE_CLASSES: Record<KpiDeltaTone, string> = {
  better: 'text-qb-pass',
  worse: 'text-qb-fail',
  neutral: 'text-qb-muted',
}

export function KpiTile({ label, value, delta, className, children }: KpiTileProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-2 rounded-xl border border-qb-border bg-qb-surface p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <dt className="truncate text-xs font-medium text-qb-muted">{label}</dt>
          <dd className="text-3xl font-semibold tracking-tight text-qb-fg tabular-nums">{value}</dd>
        </div>
        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
      {delta ? (
        <div className="flex items-center gap-1.5 text-xs tabular-nums">
          <span className={cn('font-semibold', DELTA_TONE_CLASSES[delta.tone])}>{delta.text}</span>
          <span className="sr-only">{delta.srText}</span>
        </div>
      ) : null}
    </div>
  )
}
