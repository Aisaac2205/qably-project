'use client'

import Link from 'next/link'
import type { ElementType } from 'react'
import { ArrowDown, ArrowUp, CaretRight } from '@phosphor-icons/react'
import { useTranslation } from '@/lib/i18n'

export type KpiAccent = 'default' | 'primary' | 'running' | 'fail' | 'pass' | 'ai' | 'warn'

export interface KpiCardProps {
  label: string
  value: string | number
  icon: ElementType
  accent?: KpiAccent
  href?: string
  subtext?: string
  trend?: {
    value: number
    label: string
    isPercentage?: boolean
  }
}

/**
 * High-craft operational KPI card following Emil Kowalski & Impeccable product standards:
 * - Whole-card tactile touch target (Fitts's Law)
 * - Explicit transitions with 150ms ease-out and active:scale-[0.985] press feedback
 * - Streamlined top-to-bottom vertical scanning (Label & Icon → Big Tabular Metric & Context)
 * - Semantic accents for trends and status
 */
export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = 'default',
  href,
  subtext,
  trend,
}: KpiCardProps) {
  const { t } = useTranslation()
  const showPercent = trend?.isPercentage !== false

  const cardContent = (

    <div className="flex h-full flex-col justify-between">
      {/* Tier 1: Header (Category/Label + Icon affordance) */}
      <div className="flex items-center justify-between gap-3">
        <dt className="truncate text-xs font-medium text-muted transition-colors duration-150 group-hover:text-default">
          {label}
        </dt>
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-surface-raised text-muted transition-all duration-150 group-hover:border-border-strong group-hover:text-default group-hover:shadow-2xs">
          <Icon size={15} weight="regular" aria-hidden="true" />
        </span>
      </div>

      {/* Tier 2: Hero Value (Clean tabular metric with vertical presence) */}
      <div className="my-2.5">
        <dd className="text-3xl font-semibold tracking-tight tabular-nums text-default">
          {value}
        </dd>
      </div>

      {/* Tier 3: Contextual Footer (Trend or Status badge or neutral guidance) */}
      <div className="flex min-h-5 items-center justify-between gap-2 border-t border-border/40 pt-2.5">
        {trend ? (
          <div className="flex items-center gap-1.5 text-xs tabular-nums">
            <span
              className={`inline-flex items-center gap-0.5 font-semibold ${
                trend.value > 0
                  ? 'text-pass'
                  : trend.value < 0
                    ? 'text-fail'
                    : 'text-muted'
              }`}
            >
              {trend.value > 0 ? (
                <ArrowUp size={12} weight="bold" aria-hidden="true" />
              ) : null}
              {trend.value < 0 ? (
                <ArrowDown size={12} weight="bold" aria-hidden="true" />
              ) : null}
              {trend.value > 0 ? '+' : ''}
              {trend.value}
              {showPercent ? '%' : ''}
            </span>
            <span className="truncate text-[11px] text-muted">
              {trend.label}
            </span>
          </div>
        ) : subtext ? (
          <span className="truncate text-[11px] text-muted">
            {subtext}
          </span>
        ) : (
          <span className="text-[11px] text-muted/70 transition-colors duration-150 group-hover:text-muted">
            {href ? t('common.viewDetails') : t('common.noRecentChange')}
          </span>
        )}


        {href ? (
          <CaretRight
            size={12}
            weight="bold"
            aria-hidden="true"
            className="shrink-0 text-muted/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-default"
          />
        ) : null}
      </div>

    </div>
  )

  const commonClasses =
    'group min-w-0 min-h-[120px] rounded-xl border border-border bg-surface p-4 shadow-card transition-[border-color,box-shadow,transform,background-color] duration-150 ease-out text-left'

  if (href) {
    return (
      <Link
        href={href}
        className={`${commonClasses} hover:border-border-strong hover:bg-surface-raised hover:shadow-xs active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
      >
        {cardContent}
      </Link>
    )
  }

  return <div className={commonClasses}>{cardContent}</div>
}


