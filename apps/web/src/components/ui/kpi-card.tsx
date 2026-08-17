'use client'

import Link from 'next/link'
import type { ElementType } from 'react'
import { ArrowDown, ArrowUp, CaretRight } from '@phosphor-icons/react'

export type KpiAccent = 'default' | 'primary' | 'running' | 'fail' | 'pass' | 'ai' | 'warn'

interface KpiCardProps {
  label: string
  value: string | number
  icon: ElementType
  accent?: KpiAccent
  href?: string
  detailLabel?: string
  subtext?: string
  trend?: {
    value: number
    label: string
    isPercentage?: boolean
  }
}

/** A compact operational card with pure minimalist Black and White styling. */
export function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  detailLabel = 'View details',
  subtext,
  trend,
}: KpiCardProps) {
  const showPercent = trend?.isPercentage !== false

  return (
    <div className="group min-w-0 rounded-xl border border-border bg-surface p-4 shadow-xs transition-all duration-200 hover:border-border-strong hover:shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="flex shrink-0 items-center justify-center text-muted transition-colors duration-200 group-hover:text-default">
          <Icon size={18} weight="regular" aria-hidden="true" />
        </span>
        {href ? (
          <Link
            href={href}
            className="inline-flex min-h-7 items-center gap-1 text-xs font-medium text-muted transition-colors duration-200 hover:text-default group-hover:text-default"
          >
            {detailLabel}
            <CaretRight size={12} weight="bold" aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-0.5" />
          </Link>
        ) : null}
      </div>

      <div className="mt-3.5 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
            {value}
          </dd>
          <dt className="mt-0.5 truncate text-xs font-medium text-muted">{label}</dt>
        </div>

        <div className="min-w-0 pb-0.5 text-right">
          {trend ? (
            <>
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums text-default">
                {trend.value > 0 ? <ArrowUp size={11} weight="bold" aria-hidden="true" className="text-muted" /> : null}
                {trend.value < 0 ? <ArrowDown size={11} weight="bold" aria-hidden="true" className="text-muted" /> : null}
                {trend.value > 0 ? '+' : ''}
                {trend.value}{showPercent ? '%' : ''}
              </span>
              <span className="block max-w-24 truncate text-[11px] text-muted">{trend.label}</span>
            </>
          ) : subtext ? (
            <span className="block max-w-24 text-pretty text-[11px] leading-4 text-muted">{subtext}</span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
