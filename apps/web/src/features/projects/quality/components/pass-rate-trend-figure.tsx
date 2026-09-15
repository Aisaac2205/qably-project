'use client'

import { useId, useMemo } from 'react'
import { useTranslation } from '@/lib/i18n'
import { StateView } from '@/components/ui/state-view'
import { TONE_TEXT_CLASSES, toneForPassRatePercent } from '../lib/tone'

export interface TrendPoint {
  id: string
  date: string
  passRate: number
}

interface PassRateTrendFigureProps {
  points: TrendPoint[]
}

const WIDTH = 640
const HEIGHT = 120
const TOP_INSET = 6
const BOTTOM_INSET = 6

function buildSmoothLinePath(xs: number[], ys: number[]): string {
  const n = xs.length
  if (n < 2) return ''

  let d = `M ${xs[0].toFixed(2)},${ys[0].toFixed(2)}`
  for (let i = 0; i < n - 1; i += 1) {
    const p0x = i > 0 ? xs[i - 1] : xs[i]
    const p0y = i > 0 ? ys[i - 1] : ys[i]
    const p1x = xs[i]
    const p1y = ys[i]
    const p2x = xs[i + 1]
    const p2y = ys[i + 1]
    const p3x = i + 2 < n ? xs[i + 2] : xs[i + 1]
    const p3y = i + 2 < n ? ys[i + 2] : ys[i + 1]

    const cp1x = p1x + (p2x - p0x) / 6
    const cp1y = p1y + (p2y - p0y) / 6
    const cp2x = p2x - (p3x - p1x) / 6
    const cp2y = p2y - (p3y - p1y) / 6

    d += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p2x.toFixed(2)},${p2y.toFixed(2)}`
  }
  return d
}

function buildAreaPath(linePath: string, xs: number[], baselineY: number): string {
  if (linePath === '') return ''
  const lastX = xs[xs.length - 1].toFixed(2)
  const firstX = xs[0].toFixed(2)
  return `${linePath} L ${lastX},${baselineY.toFixed(2)} L ${firstX},${baselineY.toFixed(2)} Z`
}

export function PassRateTrendFigure({ points }: PassRateTrendFigureProps) {
  const { t, locale } = useTranslation()
  const reactId = useId()

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === 'es' ? 'es-ES' : 'en-US', {
        month: 'short',
        day: 'numeric',
      }),
    [locale],
  )

  if (points.length === 0) {
    return (
      <StateView
        kind="empty"
        title={t('quality.trendEmptyTitle')}
        description={t('quality.trendEmptyDescription')}
      />
    )
  }

  const caption = t('quality.trendCaption', { count: points.length })
  const average = Math.round(
    points.reduce((sum, point) => sum + point.passRate, 0) / points.length,
  )
  const tone = toneForPassRatePercent(average)

  const n = points.length
  const usableHeight = HEIGHT - TOP_INSET - BOTTOM_INSET
  const xs = points.map((_, index) => (n === 1 ? WIDTH / 2 : (index * WIDTH) / (n - 1)))
  const ys = points.map(
    (point) =>
      HEIGHT -
      BOTTOM_INSET -
      (Math.max(0, Math.min(100, point.passRate)) / 100) * usableHeight,
  )
  const headingId = `quality-trend-heading-${reactId}`
  const gradientId = `quality-trend-gradient-${reactId}`
  const baselineY = HEIGHT - BOTTOM_INSET
  const linePath = buildSmoothLinePath(xs, ys)
  const areaPath = buildAreaPath(linePath, xs, baselineY)

  return (
    <figure aria-labelledby={headingId}>
      <figcaption id={headingId} className="mb-3 text-sm font-medium text-default">
        {caption}
      </figcaption>

      <svg
        width="100%"
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={caption}
        className="overflow-visible"
      >
        <line
          x1={0}
          y1={baselineY}
          x2={WIDTH}
          y2={baselineY}
          className="stroke-border"
          strokeWidth={1}
        />
        <g className={TONE_TEXT_CLASSES[tone]}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.22} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          {areaPath ? (
            <path className="quality-trend-area" d={areaPath} fill={`url(#${gradientId})`} />
          ) : null}
          {linePath ? (
            <path
              className="quality-trend-line"
              d={linePath}
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="currentColor"
              pathLength={1}
            />
          ) : null}
          <circle
            cx={xs[n - 1]}
            cy={ys[n - 1]}
            r={4}
            fill="currentColor"
            stroke="var(--color-surface)"
            strokeWidth={2}
            aria-hidden="true"
          />
        </g>
      </svg>

      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{t('quality.trendDateHeader')}</th>
            <th scope="col">{t('quality.trendPassRateHeader')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <td>{dateFormatter.format(new Date(point.date))}</td>
              <td>{Math.round(point.passRate)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
