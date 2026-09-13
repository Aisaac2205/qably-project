import type { ElementType } from 'react'
import { ArrowDown, ArrowUp, CaretRight } from '@phosphor-icons/react'
import { DefaultLink, type LinkComponent } from './link'
import { Sparkline, type SparklineTone } from './sparkline'

export type KpiAccent = 'default' | 'primary' | 'running' | 'fail' | 'pass' | 'ai' | 'warn'

const ACCENT_BADGE_CLASSES: Record<KpiAccent, string> = {
  default: 'border-qb-border/50 bg-qb-surface-raised text-qb-muted',
  primary: 'border-qb-primary/20 bg-qb-primary/10 text-qb-primary',
  running: 'border-qb-running/20 bg-qb-running-bg text-qb-running',
  fail: 'border-qb-fail/20 bg-qb-fail-bg text-qb-fail',
  pass: 'border-qb-pass/20 bg-qb-pass-bg text-qb-pass',
  ai: 'border-qb-ai/20 bg-qb-ai-bg text-qb-ai',
  warn: 'border-qb-warn/20 bg-qb-warn-bg text-qb-warn',
}

export interface KpiTrend {
  value: number
  label: string
  isPercentage?: boolean
}

export interface KpiSparkline {
  values: readonly number[]
  label: string
  tone?: SparklineTone
}

export interface KpiCardProps {
  label: string
  value: string | number
  icon: ElementType
  accent?: KpiAccent
  href?: string
  linkComponent?: LinkComponent
  subtext?: string
  trend?: KpiTrend
  sparkline?: KpiSparkline
  detailsLabel?: string
  idleLabel?: string
}

const BASE_CLASSES =
  'group block min-h-[120px] min-w-0 rounded-xl border border-qb-border bg-qb-surface p-4 text-left shadow-qb-card transition-[border-color,box-shadow,transform,background-color] duration-150 ease-out'

const INTERACTIVE_CLASSES =
  'cursor-pointer hover:border-qb-border-strong hover:bg-qb-surface-raised active:scale-[0.985] outline-none focus-visible:outline-2 focus-visible:outline-qb-primary'

function trendTone(value: number): string {
  if (value > 0) return 'text-qb-pass'
  if (value < 0) return 'text-qb-fail'
  return 'text-qb-muted'
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = 'default',
  href,
  linkComponent: Link = DefaultLink,
  subtext,
  trend,
  sparkline,
  detailsLabel,
  idleLabel,
}: KpiCardProps) {
  const isInteractive = href !== undefined
  const showPercent = trend?.isPercentage !== false
  const badgeHover = isInteractive
    ? accent === 'default'
      ? 'group-hover:border-qb-border-strong group-hover:text-qb-fg'
      : ''
    : ''

  const content = (
    <div className="flex h-full flex-col justify-between">
      <div className="flex items-center justify-between gap-3">
        <dt
          className={`truncate text-xs font-medium text-qb-muted transition-colors duration-150 ${
            isInteractive ? 'group-hover:text-qb-fg' : ''
          }`}
        >
          {label}
        </dt>
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition-all duration-150 ${ACCENT_BADGE_CLASSES[accent]} ${badgeHover}`}
        >
          <Icon size={15} weight="regular" aria-hidden="true" />
        </span>
      </div>

      <div className="my-2.5 flex items-end justify-between gap-3">
        <dd className="text-3xl font-semibold tracking-tight text-qb-fg">{value}</dd>
        {sparkline ? (
          <Sparkline
            values={sparkline.values}
            label={sparkline.label}
            tone={sparkline.tone ?? 'primary'}
            className="mb-1 shrink-0"
          />
        ) : null}
      </div>

      <div className="flex min-h-5 items-center justify-between gap-2 border-t border-qb-border/40 pt-2.5">
        {trend ? (
          <div className="flex items-center gap-1.5 text-xs tabular-nums">
            <span className={`inline-flex items-center gap-0.5 font-semibold ${trendTone(trend.value)}`}>
              {trend.value > 0 ? <ArrowUp size={12} weight="bold" aria-hidden="true" /> : null}
              {trend.value < 0 ? <ArrowDown size={12} weight="bold" aria-hidden="true" /> : null}
              {trend.value > 0 ? '+' : ''}
              {trend.value}
              {showPercent ? '%' : ''}
            </span>
            <span className="truncate text-[11px] text-qb-muted">{trend.label}</span>
          </div>
        ) : subtext ? (
          <span className="truncate text-[11px] text-qb-muted">{subtext}</span>
        ) : (
          <span
            className={`text-[11px] text-qb-muted/70 transition-colors duration-150 ${
              isInteractive ? 'group-hover:text-qb-muted' : ''
            }`}
          >
            {isInteractive ? detailsLabel : idleLabel}
          </span>
        )}

        {isInteractive ? (
          <CaretRight
            size={12}
            weight="bold"
            aria-hidden="true"
            className="shrink-0 text-qb-muted/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-qb-fg"
          />
        ) : null}
      </div>
    </div>
  )

  if (href !== undefined) {
    return (
      <Link href={href} className={`${BASE_CLASSES} ${INTERACTIVE_CLASSES}`}>
        {content}
      </Link>
    )
  }

  return <div className={BASE_CLASSES}>{content}</div>
}
