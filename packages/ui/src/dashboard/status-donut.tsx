'use client'

import { Cell, Pie, PieChart } from 'recharts'

export type StatusDonutTone = 'pass' | 'fail' | 'running' | 'muted'

export interface StatusDonutSlice {
  id: string
  label: string
  count: number
  tone: StatusDonutTone
}

export interface StatusDonutProps {
  slices: readonly StatusDonutSlice[]
  label: string
  emptyLabel: string
  className?: string
}

const TONE_FILL: Record<StatusDonutTone, string> = {
  pass: 'fill-qb-pass',
  fail: 'fill-qb-fail',
  running: 'fill-qb-running',
  muted: 'fill-qb-muted',
}

const SIZE = 120
const INNER_RADIUS = 34
const OUTER_RADIUS = 56

export function StatusDonut({ slices, label, emptyLabel, className }: StatusDonutProps) {
  const data = slices.filter((slice) => slice.count > 0)

  if (data.length === 0) {
    return <p className="py-8 text-center text-xs text-qb-muted">{emptyLabel}</p>
  }

  return (
    <div className={`flex items-center gap-4 ${className ?? ''}`}>
      <PieChart width={SIZE} height={SIZE} role="img" aria-label={label} tabIndex={-1}>
        <Pie
          data={data}
          dataKey="count"
          nameKey="label"
          innerRadius={INNER_RADIUS}
          outerRadius={OUTER_RADIUS}
          startAngle={90}
          endAngle={-270}
          strokeWidth={2}
          isAnimationActive={false}
        >
          {data.map((slice) => (
            <Cell key={slice.id} className={`${TONE_FILL[slice.tone]} stroke-qb-surface`} />
          ))}
        </Pie>
      </PieChart>

      <ul className="flex flex-1 flex-col gap-1.5">
        {data.map((slice) => (
          <li key={slice.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-qb-muted">
              <span className={`size-2 shrink-0 rounded-full ${TONE_FILL[slice.tone]}`} aria-hidden="true" />
              {slice.label}
            </span>
            <span className="font-semibold tabular-nums text-qb-fg">{slice.count}</span>
          </li>
        ))}
      </ul>

      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((slice) => (
            <tr key={slice.id}>
              <th scope="row">{slice.label}</th>
              <td>{slice.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
