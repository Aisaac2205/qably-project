'use client'

import { ArrowUp, CaretDown } from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'

const CHART_DATA = [
  { day: 'May 8', rate: 78 },
  { day: 'May 9', rate: 84 },
  { day: 'May 10', rate: 81 },
  { day: 'May 11', rate: 86 },
  { day: 'May 12', rate: 90 },
  { day: 'May 13', rate: 87 },
  { day: 'May 14', rate: 89 },
]

const CHART_WIDTH = 560
const CHART_HEIGHT = 172
const PLOT_LEFT = 36
const PLOT_RIGHT = 548
const PLOT_TOP = 12
const PLOT_BOTTOM = 140

function xPosition(index: number) {
  return PLOT_LEFT + (index / (CHART_DATA.length - 1)) * (PLOT_RIGHT - PLOT_LEFT)
}

function yPosition(rate: number) {
  return PLOT_TOP + ((100 - rate) / 100) * (PLOT_BOTTOM - PLOT_TOP)
}

const linePath = CHART_DATA.map((item, index) => {
  const command = index === 0 ? 'M' : 'L'
  return `${command} ${xPosition(index)} ${yPosition(item.rate)}`
}).join(' ')

const areaPath = `${linePath} L ${xPosition(CHART_DATA.length - 1)} ${PLOT_BOTTOM} L ${PLOT_LEFT} ${PLOT_BOTTOM} Z`

export function PassRateTrend() {
  const stats = useDashboardStats()
  const { t } = useTranslation()
  const period = '7 days'

  return (
    <Card className="col-span-1 flex flex-col justify-between border border-border/80">
      <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
        <CardTitle className="text-sm font-semibold text-default">{t('dashboard.passRateTrend')}</CardTitle>
        <button
          className="flex items-center gap-1.5 rounded-lg border border-border bg-canvas px-2 py-1 text-xs font-semibold text-muted transition-colors hover:bg-canvas-hover hover:text-default"
          aria-label="Select time period"
        >
          <span>{period}</span>
          <CaretDown size={10} aria-hidden="true" />
        </button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col justify-between p-5 pt-0">
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-[-0.025em] tabular-nums text-default">
            {stats.passRateLast7d}%
          </span>
          <div className="flex items-center gap-0.5 text-xs font-semibold tabular-nums text-pass">
            <ArrowUp size={12} weight="bold" aria-hidden="true" />
            <span>{stats.passRateTrend || 8}%</span>
            <span className="ml-1 text-xs font-normal text-muted">{t('dashboard.vsPrior7d')}</span>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          className="h-40 w-full"
          role="img"
          aria-label="Pass rate trend chart"
          aria-describedby="pass-rate-chart-description"
        >
          <title>Pass rate trend chart</title>
          <desc id="pass-rate-chart-description">
            Seven day pass rate ranging from 78 to 90 percent, ending at {stats.passRateLast7d} percent.
          </desc>

          {[0, 25, 50, 75, 100].map((tick) => {
            const y = yPosition(tick)

            return (
              <g key={tick}>
                <line
                  x1={PLOT_LEFT}
                  x2={PLOT_RIGHT}
                  y1={y}
                  y2={y}
                  stroke="var(--color-border)"
                  strokeDasharray="3 4"
                  vectorEffect="non-scaling-stroke"
                />
                <text x={0} y={y + 3} fontSize={9} fill="var(--color-muted)">
                  {tick}%
                </text>
              </g>
            )
          })}

          <path
            d={areaPath}
            fill="color-mix(in oklch, var(--color-default) 7%, transparent)"
          />
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-default)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {CHART_DATA.map((item, index) => (
            <text
              key={item.day}
              x={xPosition(index)}
              y={164}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-muted)"
            >
              {item.day}
            </text>
          ))}
        </svg>
      </CardContent>
    </Card>
  )
}
