import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatusDonut, type StatusDonutSlice } from '../status-donut'

const slices: StatusDonutSlice[] = [
  { id: 'pass', label: 'Aprobado', count: 4, tone: 'pass' },
  { id: 'fail', label: 'Con fallas', count: 1, tone: 'fail' },
  { id: 'running', label: 'En ejecución', count: 0, tone: 'running' },
  { id: 'never-run', label: 'Sin ejecutar', count: 0, tone: 'muted' },
]

describe('StatusDonut', () => {
  it('is an image with an accessible name', () => {
    render(<StatusDonut slices={slices} label="Proyectos por estado" emptyLabel="Sin proyectos" />)

    expect(screen.getByRole('img', { name: 'Proyectos por estado' })).toBeInTheDocument()
  })

  it('lists only the statuses that actually have projects, never zero-count ones', () => {
    render(<StatusDonut slices={slices} label="Proyectos por estado" emptyLabel="Sin proyectos" />)

    expect(screen.getAllByText('Aprobado')).toHaveLength(2) // legend item + sr-only table row
    expect(screen.getAllByText('Con fallas')).toHaveLength(2)
    expect(screen.queryByText('En ejecución')).not.toBeInTheDocument()
    expect(screen.queryByText('Sin ejecutar')).not.toBeInTheDocument()
  })

  it('shows the empty label instead of an empty ring when every slice is zero', () => {
    const empty = slices.map((slice) => ({ ...slice, count: 0 }))
    render(<StatusDonut slices={empty} label="Proyectos por estado" emptyLabel="Sin proyectos" />)

    expect(screen.getByText('Sin proyectos')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('renders a full single ring instead of a broken layout with just one project', () => {
    const single: StatusDonutSlice[] = [{ id: 'pass', label: 'Aprobado', count: 1, tone: 'pass' }]
    const { container } = render(
      <StatusDonut slices={single} label="Proyectos por estado" emptyLabel="Sin proyectos" />,
    )

    expect(screen.getByRole('img', { name: 'Proyectos por estado' })).toBeInTheDocument()
    expect(container.querySelectorAll('.recharts-pie-sector')).toHaveLength(1)
    expect(screen.getAllByText('Aprobado')).toHaveLength(2) // legend item + sr-only table row
  })

  it('keeps the counts reachable without a pointer through a table view', () => {
    render(<StatusDonut slices={slices} label="Proyectos por estado" emptyLabel="Sin proyectos" />)

    const table = screen.getByRole('table')
    expect(table).toHaveTextContent('Aprobado')
    expect(table).toHaveTextContent('4')
  })
})
