'use client'

import { useState, useLayoutEffect } from 'react'
import { CaretDown, ArrowUp } from '@phosphor-icons/react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { useDashboardStats } from '@/features/dashboard/hooks/use-dashboard-stats'
import { useTranslation } from '@/lib/i18n'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const CHART_DATA = [
  { day: 'May 8', rate: 78 },
  { day: 'May 9', rate: 84 },
  { day: 'May 10', rate: 81 },
  { day: 'May 11', rate: 86 },
  { day: 'May 12', rate: 90 },
  { day: 'May 13', rate: 87 },
  { day: 'May 14', rate: 89 },
]

export function PassRateTrend() {
  const stats = useDashboardStats()
  const { t } = useTranslation()
  const [period, setPeriod] = useState('7 days')
  const [mounted, setMounted] = useState(false)
  useLayoutEffect(() => { setMounted(true) }, [])

  return (
    <Card className="col-span-1 border border-border/80 flex flex-col justify-between">
      <CardHeader className="flex flex-row items-center justify-between pb-2 p-5">
        <CardTitle className="text-sm font-semibold text-default">{t('dashboard.passRateTrend')}</CardTitle>
        <button
          className="text-xs font-semibold px-2 py-1 bg-canvas hover:bg-canvas-hover border border-border rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer text-muted-foreground hover:text-default"
          aria-label="Select time period"
        >
          <span>{period}</span>
          <CaretDown size={10} />
        </button>
      </CardHeader>
      
      <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-between">
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-semibold tracking-tight tabular-nums font-mono text-default">
            {stats.passRateLast7d}%
          </span>
          <div className="flex items-center gap-0.5 text-xs text-pass font-semibold tabular-nums font-mono">
            <ArrowUp size={12} weight="bold" aria-hidden="true" />
            <span>{stats.passRateTrend || 8}%</span>
            <span className="text-xs font-normal text-muted-foreground ml-1">{t('dashboard.vsPrior7d')}</span>
          </div>
        </div>

        <div className="w-full h-36 mt-1">
          {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart
              data={CHART_DATA}
              margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorPassRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                vertical={false} 
                stroke="var(--color-border)" 
              />
              <XAxis 
                dataKey="day" 
                tickLine={false}
                axisLine={false}
                stroke="var(--color-muted)"
                fontSize={10}
                dy={8}
              />
              <YAxis 
                tickLine={false}
                axisLine={false}
                stroke="var(--color-muted)"
                fontSize={10}
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                ticks={[0, 25, 50, 75, 100]}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-surface border border-border p-2 rounded-lg shadow-md text-[11px]">
                        <p className="font-semibold text-default">{payload[0].payload.day}</p>
                        <p className="font-mono text-primary font-bold mt-0.5">
                          {t('dashboard.passRateKpi')}: {payload[0].value}%
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPassRate)"
              />
            </AreaChart>
          </ResponsiveContainer>
          ) : (
            <div style={{ width: '100%', height: '100%' }} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
