import React from 'react'

export interface ChartDataTableProps {
  caption: string
  headers: [string, string]
  rows: readonly [string, number][]
}

export function ChartDataTable({ caption, headers, rows }: ChartDataTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{headers[0]}</th>
          <th scope="col">{headers[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, val]) => (
          <tr key={label}>
            <td>{label}</td>
            <td>{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
