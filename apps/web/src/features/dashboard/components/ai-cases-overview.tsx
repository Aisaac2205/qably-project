'use client'

import { useState, useLayoutEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useTranslation } from '@/lib/i18n'

export function AiCasesOverview() {
  const { t } = useTranslation()
  const [mounted, setMounted] = useState(false)
  useLayoutEffect(() => { setMounted(true) }, [])

  const data = [
    { nameKey: 'dashboard.aiReady', value: 24, color: 'var(--color-pass)' },
    { nameKey: 'dashboard.aiGenerated', value: 18, color: 'var(--color-ai)' },
    { nameKey: 'dashboard.aiInReview', value: 8, color: 'var(--color-running)' },
    { nameKey: 'dashboard.aiRejected', value: 6, color: 'var(--color-fail)' },
  ]

  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card className="col-span-1 border border-border/80 flex flex-col justify-between">
      <CardHeader className="pb-2 p-5">
        <CardTitle className="text-sm font-semibold text-default">{t('dashboard.aiCasesOverview')}</CardTitle>
      </CardHeader>
      
      <CardContent className="p-5 pt-0 flex-1 flex items-center justify-between gap-4">
        <div className="relative w-28 h-28 shrink-0">
          {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={48}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          ) : (
            <div style={{ width: '100%', height: '100%' }} />
          )}
          
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold tracking-tight text-default tabular-nums font-mono">
              {total}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t('common.total')}
            </span>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-2.5 pl-2">
          {data.map((item) => (
            <div key={item.nameKey} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: item.color }} 
                />
                <span className="text-muted-foreground font-medium">{t(item.nameKey)}</span>
              </div>
              <span className="font-semibold text-default tabular-nums font-mono">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
