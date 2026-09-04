import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import { TraceabilityCalendar } from '@/features/dashboard/components/traceability-calendar'
import { buildTraceabilityGrid } from '@/features/dashboard/lib/traceability-grid'
import type { TraceabilityCalendarRecord } from '@qably/types'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

const record: TraceabilityCalendarRecord = {
  year: 2026,
  timeZone: 'America/Guatemala',
  totals: { scm: 1, proposals: 0, official: 0, runs: 214 },
  days: [
    { date: '2026-06-15', scm: 1, proposals: 0, official: 0, runs: 0 },
    { date: '2026-06-16', scm: 0, proposals: 0, official: 0, runs: 214 },
  ],
}

function renderCalendar() {
  const grid = buildTraceabilityGrid(record, 'all', MONTHS, 'en')

  return render(
    <TraceabilityCalendar
      weeks={grid.weeks}
      monthLabels={grid.monthLabels}
      locale="en"
      caption="2026 traceability calendar"
      dayLabel={(day) => `${day.count} events on ${day.date}`}
      lessLabel="Less"
      moreLabel="More"
    />,
  )
}

function cells(): HTMLElement[] {
  return screen
    .getAllByRole('gridcell')
    .filter((cell) => cell.hasAttribute('data-cell'))
}

describe('TraceabilityCalendar accessibility', () => {
  it('is a table named by its caption', () => {
    renderCalendar()

    expect(
      screen.getByRole('grid', { name: '2026 traceability calendar' }),
    ).toBeInTheDocument()
  })

  it('gives every weekday its own row header', () => {
    renderCalendar()

    expect(screen.getAllByRole('rowheader')).toHaveLength(7)
  })

  it('labels every month column', () => {
    renderCalendar()

    for (const month of MONTHS) {
      expect(screen.getByRole('columnheader', { name: month })).toBeInTheDocument()
    }
  })

  it('exposes each day to assistive technology with its own label', () => {
    renderCalendar()

    expect(
      screen.getByRole('gridcell', { name: '214 events on 2026-06-16' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('gridcell', { name: '1 events on 2026-06-15' }),
    ).toBeInTheDocument()
  })

  it('offers a single tab stop into the grid rather than 365', () => {
    renderCalendar()

    const tabbable = cells().filter((cell) => cell.getAttribute('tabindex') === '0')

    expect(tabbable).toHaveLength(1)
  })

  it('moves focus between days with the arrow keys', async () => {
    const user = userEvent.setup()
    renderCalendar()

    await user.tab()

    const start = document.activeElement as HTMLElement
    expect(start).toHaveAttribute('data-cell')

    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).not.toBe(start)
    expect(document.activeElement).toHaveAttribute('data-cell')

    await user.keyboard('{ArrowLeft}')
    expect(document.activeElement).toBe(start)
  })

  it('reveals the day summary on keyboard focus, not only on hover', () => {
    renderCalendar()

    expect(screen.queryByText(/214 traceability events/i)).not.toBeInTheDocument()

    const busiest = screen.getByRole('gridcell', {
      name: '214 events on 2026-06-16',
    })
    fireEvent.focus(busiest)
    expect(screen.getByText(/214 traceability events/i)).toBeInTheDocument()

    fireEvent.blur(busiest)
    expect(screen.queryByText(/214 traceability events/i)).not.toBeInTheDocument()
  })

  it('hides the tooltip from assistive technology, which already reads the cell', () => {
    renderCalendar()

    const busiest = screen.getByRole('gridcell', {
      name: '214 events on 2026-06-16',
    })
    fireEvent.focus(busiest)

    const tooltip = screen.getByText(/214 traceability events/i)
    expect(tooltip).toHaveAttribute('aria-hidden', 'true')
  })

  it('paints intensity from the heatmap tokens rather than hardcoded colours', () => {
    renderCalendar()

    const busiest = screen.getByRole('gridcell', {
      name: '214 events on 2026-06-16',
    })

    const swatch = busiest.firstElementChild as HTMLElement

    expect(swatch.className).toContain('bg-heatmap-l')
    expect(swatch.className).toContain('aspect-square')
    expect(swatch.getAttribute('style')).toBeNull()
  })

  it('keeps the legend out of the accessibility tree', () => {
    const { container } = renderCalendar()
    const legend = within(container).getByText('Less').parentElement

    expect(
      legend?.querySelectorAll('[aria-hidden="true"]').length,
    ).toBeGreaterThan(0)
  })

  it('lets the grid share the available width instead of fixed cells', () => {
    renderCalendar()

    const grid = screen.getByRole('grid', { name: '2026 traceability calendar' })

    expect(grid.className).toContain('table-fixed')
    expect(grid.className).toContain('w-full')
    expect(grid.querySelector('colgroup')).not.toBeNull()
  })
})
