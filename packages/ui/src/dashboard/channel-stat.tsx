import { cn } from '../utils'

export type ChannelStatTone = 'default' | 'muted' | 'pass' | 'fail'

export interface ChannelStatProps {
  value: number | string
  unit: string
  srText: string
  tone?: ChannelStatTone
  className?: string
  'data-testid'?: string
}

const TONE_CLASSES: Record<ChannelStatTone, string> = {
  default: 'text-qb-fg',
  muted: 'text-qb-muted',
  pass: 'text-qb-pass',
  fail: 'text-qb-fail',
}

export function ChannelStat({
  value,
  unit,
  srText,
  tone = 'default',
  className,
  'data-testid': dataTestId,
}: ChannelStatProps) {
  return (
    <div className={cn('flex flex-col items-end', className)} data-testid={dataTestId}>
      <span aria-hidden="true" className="flex flex-col items-end gap-0.5">
        <span className={cn('font-mono text-base font-medium tabular-nums', TONE_CLASSES[tone])}>{value}</span>
        <span className="text-xs text-qb-muted">{unit}</span>
      </span>
      <span className="sr-only">{srText}</span>
    </div>
  )
}
