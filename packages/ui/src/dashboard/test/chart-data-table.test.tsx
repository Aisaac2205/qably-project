import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartDataTable } from '../chart-data-table'

interface Row {
  id: string
  label: string
  value: number
}

const rows: readonly Row[] = [
  { id: 'mon', label: 'Monday', value: 10 },
  { id: 'tue', label: 'Tuesday', value: 20 },
]

describe('ChartDataTable', () => {
  it('is visually hidden but present for assistive technology', () => {
    const { container } = render(
      <ChartDataTable
        caption="Runs per day"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { key: 'label', header: 'Day', render: (row) => row.label },
          { key: 'value', header: 'Runs', render: (row) => row.value },
        ]}
      />,
    )

    const table = container.querySelector('table')
    expect(table).toHaveClass('sr-only')
  })

  it('uses a fixed table layout so wide sr-only content cannot force the page to scroll horizontally', () => {
    const { container } = render(
      <ChartDataTable
        caption="Runs per day"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { key: 'label', header: 'Day', render: (row) => row.label },
          { key: 'value', header: 'Runs', render: (row) => row.value },
        ]}
      />,
    )

    const table = container.querySelector('table')
    expect(table).toHaveClass('table-fixed')
  })

  it('renders one row per data point mirroring the columns', () => {
    render(
      <ChartDataTable
        caption="Runs per day"
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { key: 'label', header: 'Day', render: (row) => row.label },
          { key: 'value', header: 'Runs', render: (row) => row.value },
        ]}
      />,
    )

    expect(screen.getByText('Runs per day')).toBeInTheDocument()
    const table = screen.getByRole('table')
    const bodyRows = within(table).getAllByRole('row').slice(1)
    expect(bodyRows).toHaveLength(2)
    expect(within(bodyRows[0] as HTMLElement).getByText('Monday')).toBeInTheDocument()
    expect(within(bodyRows[0] as HTMLElement).getByText('10')).toBeInTheDocument()
    expect(within(bodyRows[1] as HTMLElement).getByText('Tuesday')).toBeInTheDocument()
    expect(within(bodyRows[1] as HTMLElement).getByText('20')).toBeInTheDocument()
  })

  it('renders zero body rows when there is no data, without throwing', () => {
    render(
      <ChartDataTable
        caption="Runs per day"
        rows={[]}
        rowKey={(row: Row) => row.id}
        columns={[{ key: 'label', header: 'Day', render: (row: Row) => row.label }]}
      />,
    )

    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(1)
  })
})
