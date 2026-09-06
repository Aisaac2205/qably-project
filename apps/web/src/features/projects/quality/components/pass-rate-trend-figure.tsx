'use client'

import { useId, useMemo } from 'react'
import { useTranslation } from '@/lib/i18n'
import { StateView } from '@/components/ui/state-view'

export interface TrendPoint {
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

const TONE_CLASSES = {
  pass: 'text-pass',
  warn: 'text-warn',
  fail: 'text-fail',
} as const

function toneFor(averagePassRate: number): keyof typeof TONE_CLASSES {
  if (averagePassRate >= 70) return 'pass'
  if (averagePassRate > 0) return 'warn'
  return 'fail'
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
  const tone = toneFor(average)

  const n = points.length
  const usableHeight = HEIGHT - TOP_INSET - BOTTOM_INSET
  const xs = points.map((_, index) => (n === 1 ? WIDTH / 2 : (index * WIDTH) / (n - 1)))
  const ys = points.map(
    (point) =>
      HEIGHT -
      BOTTOM_INSET -
      (Math.max(0, Math.min(100, point.passRate)) / 100) * usableHeight,
  )
  const polylinePoints = xs.map((x, index) => `${x.toFixed(2)},${ys[index].toFixed(2)}`).join(' ')
  const headingId = `quality-trend-heading-${reactId}`

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
          y1={HEIGHT - BOTTOM_INSET}
          x2={WIDTH}
          y2={HEIGHT - BOTTOM_INSET}
          className="stroke-border"
          strokeWidth={1}
        />
        <polyline
          points={polylinePoints}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          stroke="currentColor"
          className={TONE_CLASSES[tone]}
        />
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
            <tr key={point.date}>
              <td>{dateFormatter.format(new Date(point.date))}</td>
              <td>{Math.round(point.passRate)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
