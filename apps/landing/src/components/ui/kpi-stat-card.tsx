'use client'

const Link = ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
  <a href={href} {...props}>{children}</a>
)
import { useMemo, useState } from 'react'
import { curveCardinal } from 'd3-shape'
import { Area, AreaChart, ChartStatFlow, LinearGradient } from '@/components/charts'
import type { ChartStatFlowFormat } from '@/components/charts/chart-stat-flow'
import {
  StatCardChart,
  statCardValueClassName,
  type StatCardHoverState,
} from '@/components/stat-card-chart'
import { StatCardHoverBridge } from '@/components/stat-card-hover-bridge'
import { TrendBadge } from '@/components/trend-badge'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type KpiStatTone = 'primary' | 'pass' | 'fail' | 'warn' | 'muted'

const TONE_COLOR: Record<KpiStatTone, string> = {
  primary: 'var(--qb-chart-line)',
  pass: 'var(--qb-chart-pass)',
  fail: 'var(--qb-chart-fail)',
  warn: 'var(--qb-chart-warn)',
  muted: 'var(--qb-chart-compare)',
}

export interface KpiStatPoint {
  date: Date
  value: number
}

export interface KpiStatCardProps {
  label: string
  value: number
  /** Omit when the metric has no daily series; the card then renders without a sparkline. */
  series?: readonly KpiStatPoint[]
  tone?: KpiStatTone
  trend?: number | null
  format?: ChartStatFlowFormat
  /** BCP 47 locale for the number display. Default: browser locale. */
  locale?: string
  /** Formats the hovered sparkline point's date for the label under the value. */
  formatLabel?: (date: Date) => string
  suffix?: string
  href?: string
  chartLabel?: string
  className?: string
}

function defaultFormatLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function KpiStatCard({
  label,
  value,
  series,
  tone = 'primary',
  trend = null,
  format,
  locale,
  formatLabel = defaultFormatLabel,
  suffix,
  href,
  chartLabel,
  className,
}: KpiStatCardProps) {
  const [hover, setHover] = useState<StatCardHoverState>({ value: null, label: null, trend: null })
  const color = TONE_COLOR[tone]
  const gradientId = useMemo(() => `kpi-stat-fill-${label.replace(/\W+/g, '-').toLowerCase()}`, [label])

  const hasSeries = series !== undefined && series.length > 1
  const displayValue = hover.value ?? value
  const displayTrend = hover.trend ?? trend

  const card = (
    <Card className={cn('w-full gap-0 py-0', href !== undefined && 'transition-colors duration-150 group-hover:border-border-strong', className)}>
      <CardHeader className="px-4 py-3">
        <CardTitle as="h3" className="truncate text-xs font-medium text-muted">
          {label}
        </CardTitle>
        <CardAction className="flex h-5 items-center">
          {displayTrend !== null ? <TrendBadge value={displayTrend} /> : null}
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 px-4 pt-0 pb-3">
        <div className="flex min-h-11 flex-col justify-end">
          <ChartStatFlow
            formatOptions={format}
            label={hover.label ?? ' '}
            labelClassName="mt-0.5 block h-4 text-xs"
            locale={locale}
            suffix={suffix}
            value={displayValue}
            valueClassName={statCardValueClassName}
          />
        </div>

        {hasSeries ? (
          <StatCardChart size="sm">
            <AreaChart
              aspectRatio="2.5 / 1"
              className="w-full touch-none"
              data={series as unknown as Record<string, unknown>[]}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <StatCardHoverBridge dataKey="value" formatLabel={formatLabel} onHoverChange={setHover} />
              <LinearGradient from={color} fromOpacity={0.45} id={gradientId} to={color} toOpacity={0} />
              <Area
                curve={curveCardinal.tension(0.65)}
                dataKey="value"
                fill={`url(#${gradientId})`}
                fillOpacity={1}
                gradientToOpacity={0}
                showHighlight
                stroke={color}
                strokeWidth={2}
              />
            </AreaChart>
          </StatCardChart>
        ) : null}
      </CardContent>
    </Card>
  )

  if (href === undefined) return card

  return (
    <Link
      aria-label={chartLabel ?? label}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      href={href}
    >
      {card}
    </Link>
  )
}
