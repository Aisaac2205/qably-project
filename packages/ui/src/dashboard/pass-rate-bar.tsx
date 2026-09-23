import { cn } from '../utils'

export interface PassRateBarProps {
  value: number | null
  label: string
  emptyLabel?: string
  warnBelow?: number
  color?: string
  className?: string
}

const DEFAULT_WARN_BELOW = 90

export function PassRateBar({
  value,
  label,
  emptyLabel = label,
  warnBelow = DEFAULT_WARN_BELOW,
  color,
  className,
}: PassRateBarProps) {
  const clamped = value === null ? 0 : Math.min(100, Math.max(0, value))
  const tone = value === null ? '' : value >= warnBelow ? 'bg-qb-pass' : 'bg-qb-warn'

  return (
    <div
      role="img"
      aria-label={value === null ? emptyLabel : label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-qb-border/30', className)}
    >
      <div
        data-slot="pass-rate-bar-fill"
        className={cn('h-full rounded-full transition-[width] duration-300 ease-out', !color && tone)}
        style={{ width: `${clamped}%`, ...(color ? { backgroundColor: color } : {}) }}
      />
    </div>
  )
}
