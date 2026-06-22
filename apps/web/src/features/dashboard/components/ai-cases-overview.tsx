'use client'

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const DATA = [
  { name: 'Ready', value: 24, color: 'var(--color-pass)' },
  { name: 'Generated', value: 18, color: 'var(--color-ai)' },
  { name: 'In review', value: 8, color: 'var(--color-running)' },
  { name: 'Rejected', value: 6, color: 'var(--color-fail)' },
]

export function AiCasesOverview() {
  const total = DATA.reduce((sum, item) => sum + item.value, 0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <Card className="col-span-1 border border-border/80 flex flex-col justify-between">
      <CardHeader className="pb-2 p-5">
        <CardTitle className="text-sm font-semibold text-default">AI cases overview</CardTitle>
      </CardHeader>
      
      <CardContent className="p-5 pt-0 flex-1 flex items-center justify-between gap-4">
        {/* Donut Chart container — client-only to avoid SSR dimension warnings */}
        <div className="relative w-28 h-28 shrink-0">
          {mounted ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={DATA}
                cx="50%"
                cy="50%"
                innerRadius={35}
                outerRadius={48}
                paddingAngle={2}
                dataKey="value"
              >
                {DATA.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          ) : (
            <div style={{ width: '100%', height: '100%' }} />
          )}
          
          {/* Centered text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-xl font-bold tracking-tight text-default tabular-nums font-mono">
              {total}
            </span>
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
              Total
            </span>
          </div>
        </div>

        {/* Legend list */}
        <div className="flex-1 flex flex-col gap-2.5 pl-2">
          {DATA.map((item) => (
            <div key={item.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: item.color }} 
                />
                <span className="text-muted-foreground font-medium">{item.name}</span>
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
