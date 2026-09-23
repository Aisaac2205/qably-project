import type { ReactNode } from 'react'
import { cn } from '../utils'

export interface ChartDataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
}

export interface ChartDataTableProps<T> {
  caption: string
  rows: readonly T[]
  rowKey: (row: T) => string
  columns: readonly ChartDataTableColumn<T>[]
  className?: string
}

export function ChartDataTable<T>({ caption, rows, rowKey, columns, className }: ChartDataTableProps<T>) {
  return (
    <table className={cn('sr-only', className)}>
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)}>
            {columns.map((column) => (
              <td key={column.key}>{column.render(row)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
