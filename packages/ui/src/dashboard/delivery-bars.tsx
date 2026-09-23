import { cn } from '../utils'
import { ChartDataTable } from './chart-data-table'

export interface DeliveryBarPoint {
  date: string
  sent: number
  failed: number
}

export interface DeliveryBarsProps {
  points: readonly DeliveryBarPoint[]
  label: string
  emptyLabel?: string
  sentLabel?: string
  failedLabel?: string
  className?: string
}

const MAX_BAR_HEIGHT = 26
const MIN_BAR_HEIGHT = 4

function barTone(point: DeliveryBarPoint): string {
  if (point.failed > 0) return 'bg-qb-fail'
  if (point.sent > 0) return 'bg-qb-fg'
  return 'bg-qb-border'
}

export function DeliveryBars({
  points,
  label,
  emptyLabel = label,
  sentLabel = 'Sent',
  failedLabel = 'Failed',
  className,
}: DeliveryBarsProps) {
  if (points.length === 0) {
    return <p className="py-4 text-center text-xs text-qb-muted">{emptyLabel}</p>
  }

  const max = Math.max(1, ...points.map((point) => point.sent))

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex h-7 items-end gap-0.5" role="img" aria-label={label}>
        {points.map((point) => {
          const height =
            point.sent === 0 ? MIN_BAR_HEIGHT : Math.max(MIN_BAR_HEIGHT, Math.round((point.sent / max) * MAX_BAR_HEIGHT))
          return (
            <div
              key={point.date}
              data-slot="delivery-bar"
              className={cn('w-1 shrink-0 rounded-sm', barTone(point))}
              style={{ height }}
            />
          )
        })}
      </div>
      <ChartDataTable
        caption={label}
        rows={points}
        rowKey={(point) => point.date}
        columns={[
          { key: 'date', header: 'Date', render: (point) => point.date },
          { key: 'sent', header: sentLabel, render: (point) => point.sent },
          { key: 'failed', header: failedLabel, render: (point) => point.failed },
        ]}
      />
    </div>
  )
}
