'use client'

import type { ElementType } from 'react'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'

export type KpiAccent = 'default' | 'primary' | 'running' | 'fail' | 'pass' | 'ai' | 'warn'

const ACCENT_CLASSES: Record<KpiAccent, { container: string; icon: string }> = {
  default: {
    container: 'bg-primary/10 border border-primary/20',
    icon: 'text-primary',
  },
  primary: {
    container: 'bg-primary/10 border border-primary/20',
    icon: 'text-primary',
  },
  running: {
    container: 'bg-running-bg border border-running/20',
    icon: 'text-running',
  },
  fail: {
    container: 'bg-fail-bg border border-fail/20',
    icon: 'text-fail',
  },
  pass: {
    container: 'bg-pass-bg border border-pass/20',
    icon: 'text-pass',
  },
  ai: {
    container: 'bg-ai-bg border border-ai/20',
    icon: 'text-ai',
  },
  warn: {
    container: 'bg-warn-bg border border-warn/20',
    icon: 'text-warn',
  },
}

interface KpiCardProps {
  label: string
  value: string | number
  icon: ElementType
  accent?: KpiAccent
  subtext?: string
  trend?: {
    value: number
    label: string
    isPercentage?: boolean
  }
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = 'primary',
  subtext,
  trend,
}: KpiCardProps) {
  const colors = ACCENT_CLASSES[accent] || ACCENT_CLASSES.primary
  const showPercent = trend && trend.isPercentage !== false

  return (
    <Card className="hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-border/80">
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors.container} shrink-0`}>
            <Icon size={18} className={colors.icon} aria-hidden="true" />
          </div>
          <span className="text-sm font-medium text-muted truncate">{label}</span>
        </div>

        <div className="mt-4 text-3xl font-semibold tracking-tight tabular-nums font-mono text-default">
          {value}
        </div>

        <div className="mt-2.5 min-h-[16px] flex items-center">
          {trend ? (
            <div className="flex items-center gap-1.5">
              {trend.value > 0 ? (
                <span className="flex items-center gap-0.5 text-xs text-pass font-semibold tabular-nums font-mono">
                  <ArrowUp size={12} weight="bold" aria-hidden="true" />
                  +{trend.value}{showPercent ? '%' : ''}
                </span>
              ) : trend.value < 0 ? (
                <span className="flex items-center gap-0.5 text-xs text-fail font-semibold tabular-nums font-mono">
                  <ArrowDown size={12} weight="bold" aria-hidden="true" />
                  {trend.value}{showPercent ? '%' : ''}
                </span>
              ) : (
                <span className="text-xs text-muted font-medium tabular-nums font-mono">
                  {trend.value}{showPercent ? '%' : ''}
                </span>
              )}
              <span className="text-xs text-muted">{trend.label}</span>
            </div>
          ) : subtext ? (
            <span className="text-xs text-muted font-medium">{subtext}</span>
          ) : (
            <span className="text-xs text-transparent" aria-hidden="true">—</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
