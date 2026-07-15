'use client'

/**
 * Sparkline — inline SVG showing 7-day pass-rate trend.
 *
 * - No external chart library.
 * - Animated via CSS `stroke-dasharray` transition; `prefers-reduced-motion` honored.
 * - `role="img"` with a computed aria-label.
 * - Color tone selectable via `tone` prop (pass / fail / warn / muted).
 * - The 7 data points are mapped: x = index * (W / 6), y = H - (passRate / 100) * H.
 */
import { useId, useMemo } from 'react'
import { useTranslation } from '@/lib/i18n'

interface SparklineProps {
  data: Array<{ date: string; passRate: number }>
  width?: number
  height?: number
  tone?: 'pass' | 'fail' | 'warn' | 'muted'
  ariaLabel?: string
  className?: string
}

const TONE_CLASSES: Record<NonNullable<SparklineProps['tone']>, string> = {
  pass: 'text-pass',
  fail: 'text-fail',
  warn: 'text-warn',
  muted: 'text-muted',
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  tone = 'muted',
  ariaLabel,
  className,
}: SparklineProps) {
  const { t } = useTranslation()
  const id = useId()
  const toneClass = TONE_CLASSES[tone]

  const { points, polylinePoints, label } = useMemo(() => {
    if (data.length === 0) {
      return { points: [], polylinePoints: '', label: t('suites.noData') }
    }
    const n = data.length
    const xs = data.map((_, i) => (n === 1 ? width / 2 : (i * width) / (n - 1)))
    const ys = data.map((d) => height - (Math.max(0, Math.min(100, d.passRate)) / 100) * height)
    const pts = xs.map((x, i) => ({ x, y: ys[i] }))
    const polyline = pts.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ')
    const avg = Math.round(data.reduce((acc, d) => acc + d.passRate, 0) / n)
    return { points: pts, polylinePoints: polyline, label: t('suites.passRateTrend', { avg, days: n }) }
  }, [data, width, height, t])

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? label}
      className={className}
    >
      <line
        x1={0}
        y1={height - 0.5}
        x2={width}
        y2={height - 0.5}
        className="stroke-border"
        strokeWidth={1}
      />
      {points.length > 0 && (
        <>
          <polyline
            points={polylinePoints}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${toneClass} [stroke-dasharray:200] motion-safe:[stroke-dashoffset:200] motion-safe:[animation:sparkline-draw_400ms_cubic-bezier(0.16,1,0.3,1)_forwards]`}
            data-testid={`sparkline-line-${id}`}
          />
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={1.5}
              className={toneClass}
              fill="currentColor"
              data-testid={`sparkline-dot-${i}`}
            />
          ))}
        </>
      )}
    </svg>
  )
}
