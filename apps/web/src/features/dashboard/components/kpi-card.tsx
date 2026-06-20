'use client'

import type { ElementType } from 'react'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import {
  Card,
  CardHeader,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

type Accent = 'default' | 'pass' | 'fail' | 'warn' | 'ai'

const ACCENT_CLASSES: Record<Accent, { icon: string; trendUp: string; trendDown: string }> = {
  default: { icon: 'text-primary', trendUp: 'text-pass', trendDown: 'text-fail' },
  pass: { icon: 'text-pass', trendUp: 'text-pass', trendDown: 'text-fail' },
  fail: { icon: 'text-fail', trendUp: 'text-pass', trendDown: 'text-fail' },
  warn: { icon: 'text-warn', trendUp: 'text-pass', trendDown: 'text-fail' },
  ai: { icon: 'text-ai', trendUp: 'text-pass', trendDown: 'text-fail' },
}

interface KpiCardProps {
  label: string
  value: string | number
  icon: ElementType
  trend?: {
    value: number
    label: string
  }
  accent?: Accent
}

export function KpiCard({ label, value, icon: Icon, trend, accent = 'default' }: KpiCardProps) {
  const colors = ACCENT_CLASSES[accent]

  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <Icon size={20} className={colors.icon} aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums font-mono text-default">
          {value}
        </div>
        {trend && (
          <div className="flex items-center gap-1 mt-1.5">
            {trend.value > 0 ? (
              <ArrowUp size={14} weight="bold" className={colors.trendUp} aria-hidden="true" />
            ) : trend.value < 0 ? (
              <ArrowDown size={14} weight="bold" className={colors.trendDown} aria-hidden="true" />
            ) : (
              <span className="w-[14px]" aria-hidden="true" />
            )}
            <span
              className={
                trend.value > 0
                  ? 'text-xs text-pass font-medium tabular-nums font-mono'
                  : trend.value < 0
                    ? 'text-xs text-fail font-medium tabular-nums font-mono'
                    : 'text-xs text-muted font-medium tabular-nums font-mono'
              }
            >
              {Math.abs(trend.value)}%
            </span>
            <span className="text-xs text-muted">{trend.label}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
