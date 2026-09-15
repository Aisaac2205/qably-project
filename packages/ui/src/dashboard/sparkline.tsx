import { Line, LineChart } from 'recharts'

export type SparklineTone = 'pass' | 'fail' | 'warn' | 'muted' | 'primary'

const TONE_FILL: Record<SparklineTone, string> = {
  pass: 'fill-qb-pass',
  fail: 'fill-qb-fail',
  warn: 'fill-qb-warn',
  muted: 'fill-qb-muted',
  primary: 'fill-qb-primary',
}

const TONE_STROKE: Record<SparklineTone, string> = {
  pass: 'stroke-qb-pass',
  fail: 'stroke-qb-fail',
  warn: 'stroke-qb-warn',
  muted: 'stroke-qb-muted',
  primary: 'stroke-qb-primary',
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

interface SparkDotProps {
  cx?: number
  cy?: number
  index?: number
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

  const data = values.map((value, index) => ({ index, value }))

  return (
    <LineChart
      width={width}
      height={height}
      data={data}
      role="img"
      aria-label={label}
      accessibilityLayer={false}
      tabIndex={-1}
      margin={{ top: INSET, right: INSET, bottom: INSET, left: INSET }}
      className={className ?? ''}
    >
      <Line
        type="monotone"
        dataKey="value"
        className={TONE_STROKE[tone]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        isAnimationActive={false}
        activeDot={false}
        dot={(dotProps: SparkDotProps) => {
          const isLast = dotProps.index === values.length - 1
          if (!isLast) {
            return <g key={`dot-${dotProps.index}`} />
          }
          return (
            <circle
              key="marker"
              cx={dotProps.cx}
              cy={dotProps.cy}
              r={MARKER_RADIUS}
              className={`stroke-qb-surface ${TONE_FILL[tone]}`}
              strokeWidth={RING}
            />
          )
        }}
      />
    </LineChart>
  )
}
