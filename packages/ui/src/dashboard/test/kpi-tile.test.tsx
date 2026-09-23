import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KpiTile } from '../kpi-tile'

describe('KpiTile', () => {
  it('renders the label and the big tabular value', () => {
    render(<KpiTile label="Pass rate" value="89%" />)

    expect(screen.getByText('Pass rate')).toBeInTheDocument()
    const value = screen.getByText('89%')
    expect(value).toHaveClass('tabular-nums')
  })

  it('uses font-medium and tracking-tight for the value, not font-semibold, per the mockup', () => {
    render(<KpiTile label="Pass rate" value="89%" />)

    const value = screen.getByText('89%')
    expect(value).toHaveClass('font-medium', 'tracking-tight')
    expect(value).not.toHaveClass('font-semibold')
  })

  it('renders caller-supplied children, such as a sparkline, without computing polarity itself', () => {
    render(
      <KpiTile label="Runs" value={87}>
        <svg data-testid="child-sparkline" />
      </KpiTile>,
    )

    expect(screen.getByTestId('child-sparkline')).toBeInTheDocument()
  })

  it('renders a better delta with the pass tone and its screen-reader text', () => {
    render(<KpiTile label="Pass rate" value="89%" delta={{ text: '+5%', tone: 'better', srText: 'improved by 5 percent versus the previous period' }} />)

    const delta = screen.getByText('+5%')
    expect(delta).toHaveClass('text-qb-pass')
    expect(screen.getByText('improved by 5 percent versus the previous period')).toHaveClass('sr-only')
  })

  it('renders a worse delta with the fail tone regardless of arithmetic sign', () => {
    render(
      <KpiTile
        label="Failed cases"
        value={3}
        delta={{ text: '-2', tone: 'worse', srText: 'worsened by 2 versus the previous period' }}
      />,
    )

    expect(screen.getByText('-2')).toHaveClass('text-qb-fail')
  })

  it('renders a neutral delta with the muted tone', () => {
    render(<KpiTile label="Runs" value={87} delta={{ text: '0%', tone: 'neutral', srText: 'unchanged' }} />)

    expect(screen.getByText('0%')).toHaveClass('text-qb-muted')
  })

  it('renders without a delta section when none is supplied', () => {
    render(<KpiTile label="Runs" value={87} />)

    expect(screen.queryByText(/versus/)).not.toBeInTheDocument()
  })

  it('orders content value, then label, then delta, top to bottom per the mockup', () => {
    render(
      <KpiTile label="Pass rate" value="89%" delta={{ text: '+5%', tone: 'better', srText: 'x' }} />,
    )

    const value = screen.getByText('89%')
    const label = screen.getByText('Pass rate')
    const delta = screen.getByText('+5%')

    expect(value.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(label.compareDocumentPosition(delta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('gives the label an 8px gap from the value and the delta a 12px gap from the label', () => {
    render(
      <KpiTile label="Pass rate" value="89%" delta={{ text: '+5%', tone: 'better', srText: 'x' }} />,
    )

    expect(screen.getByText('Pass rate')).toHaveClass('mt-2')
    expect(screen.getByText('+5%').closest('div')).toHaveClass('mt-3')
  })

  it('aligns caller-supplied children, such as a sparkline, to the bottom-right of the tile', () => {
    const { container } = render(
      <KpiTile label="Runs" value={87}>
        <svg data-testid="child-sparkline" />
      </KpiTile>,
    )

    const row = container.querySelector('.items-end')
    expect(row).toBeInTheDocument()
    expect(row?.querySelector('[data-testid="child-sparkline"]')).toBeInTheDocument()
  })
})
