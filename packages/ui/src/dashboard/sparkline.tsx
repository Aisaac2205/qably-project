export type SparklineTone = 'pass' | 'fail' | 'warn' | 'muted' | 'primary'

const TONE_FILL: Record<SparklineTone, string> = {
  pass: 'fill-qb-pass',
  fail: 'fill-qb-fail',
  warn: 'fill-qb-warn',
  muted: 'fill-qb-muted',
  primary: 'fill-qb-primary',
}

export interface SparklineProps {
  values: readonly number[]
  label: string
  tone?: SparklineTone
  width?: number
  height?: number
  className?: string
}

const MARKER_RADIUS = 4
const RING = 2
const INSET = MARKER_RADIUS + RING

export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
): { x: number; y: number }[] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const usableHeight = height - INSET * 2
  const step = values.length > 1 ? (width - INSET * 2) / (values.length - 1) : 0

  return values.map((value, index) => ({
    x: INSET + index * step,
    y: span === 0 ? height / 2 : INSET + ((max - value) / span) * usableHeight,
  }))
}

export function Sparkline({
  values,
  label,
  tone = 'primary',
  width = 72,
  height = 24,
  className,
}: SparklineProps) {
  if (values.length < 2) return null

  const points = sparklinePoints(values, width, height)
  const last = points[points.length - 1] as { x: number; y: number }

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
    >
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        className="stroke-qb-muted"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last.x}
        cy={last.y}
        r={MARKER_RADIUS}
        className={`stroke-qb-surface ${TONE_FILL[tone]}`}
        strokeWidth={RING}
      />
    </svg>
  )
}
