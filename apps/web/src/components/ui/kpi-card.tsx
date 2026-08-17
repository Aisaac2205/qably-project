'use client'

import Link from 'next/link'
import type { ElementType } from 'react'
import { ArrowDown, ArrowRight, ArrowUp } from '@phosphor-icons/react'

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

/** A compact operational card derived from the approved dashboard reference. */
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
    <div className="group min-w-0 rounded-xl border border-border bg-surface p-3.5 transition-colors duration-200 hover:border-border-strong">
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-default text-surface">
          <Icon size={16} weight="regular" aria-hidden="true" />
        </span>
        {href ? (
          <Link
            href={href}
            className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-muted transition-colors duration-200 hover:text-default"
          >
            {detailLabel}
            <ArrowRight size={13} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <div className="mt-4 flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <dd className="text-2xl font-semibold tracking-[-0.025em] tabular-nums text-default">
            {value}
          </dd>
          <dt className="mt-0.5 truncate text-xs text-muted">{label}</dt>
        </div>

        <div className="min-w-0 pb-0.5 text-right">
          {trend ? (
            <>
              <span
                className={
                  trend.value > 0
                    ? 'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums text-pass'
                    : trend.value < 0
                      ? 'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums text-fail'
                      : 'text-xs font-medium tabular-nums text-muted'
                }
              >
                {trend.value > 0 ? <ArrowUp size={11} weight="bold" aria-hidden="true" /> : null}
                {trend.value < 0 ? <ArrowDown size={11} weight="bold" aria-hidden="true" /> : null}
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
