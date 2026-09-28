import React from 'react'
import { cn } from '@/lib/utils'

export interface ChannelStatProps {
  value: number
  unit: string
  srText: string
  tone?: 'pass' | 'fail' | 'default'
  'data-testid'?: string
  className?: string
}

export function ChannelStat({
  value,
  unit,
  srText,
  tone = 'default',
  'data-testid': testId,
  className,
}: ChannelStatProps) {
  const toneClass =
    tone === 'pass'
      ? 'text-pass'
      : tone === 'fail'
        ? 'text-fail'
        : 'text-default'

  return (
    <span data-testid={testId} className={cn('inline-flex items-baseline gap-1', className)}>
      <span aria-hidden="true" className={cn('font-mono font-medium tabular-nums', toneClass)}>
        {value}
      </span>
      <span aria-hidden="true" className="text-muted">
        {unit}
      </span>
      <span className="sr-only">{srText}</span>
    </span>
  )
}
