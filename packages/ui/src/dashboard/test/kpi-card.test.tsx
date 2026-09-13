import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Play } from '@phosphor-icons/react'
import type { ReactNode } from 'react'
import { KpiCard } from '../kpi-card'

function FakeLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a href={href} className={className} data-testid="fake-link">
      {children}
    </a>
  )
}

describe('KpiCard', () => {
  it('renders the label as the term and the value as the definition', () => {
    render(
      <dl>
        <KpiCard label="Runs · 7d" value={87} icon={Play} />
      </dl>,
    )

    expect(screen.getByText('Runs · 7d').tagName).toBe('DT')
    expect(screen.getByText('87').tagName).toBe('DD')
  })

  it('shows a signed percentage trend with a direction arrow', () => {
    render(
      <dl>
        <KpiCard
          label="Pass rate"
          value="89%"
          icon={Play}
          trend={{ value: 5, label: 'vs prior 7d', isPercentage: true }}
        />
      </dl>,
    )

    expect(screen.getByText('+5%')).toHaveClass('text-qb-pass')
    expect(screen.getByText('vs prior 7d')).toBeInTheDocument()
  })

  it('colours a negative trend with the fail token', () => {
    render(
      <dl>
        <KpiCard label="Pass rate" value="72%" icon={Play} trend={{ value: -3, label: 'vs prior 7d' }} />
      </dl>,
    )

    expect(screen.getByText('-3%')).toHaveClass('text-qb-fail')
  })

  it('renders through the caller link component when it has an href', () => {
    render(
      <dl>
        <KpiCard label="Pending" value={3} icon={Play} href="/review-inbox" linkComponent={FakeLink} detailsLabel="View details" />
      </dl>,
    )

    expect(screen.getByTestId('fake-link')).toHaveAttribute('href', '/review-inbox')
    expect(screen.getByText('View details')).toBeInTheDocument()
  })

  it('stays a plain block without an href and shows the idle label instead of a link affordance', () => {
    render(
      <dl>
        <KpiCard label="Pending" value={3} icon={Play} idleLabel="No recent change" />
      </dl>,
    )

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.getByText('No recent change')).toBeInTheDocument()
  })

  it('tints the icon badge by accent using qb tokens', () => {
    render(
      <dl>
        <KpiCard label="Pending" value={3} icon={Play} accent="ai" />
      </dl>,
    )

    const badge = document.querySelector('svg')?.parentElement
    expect(badge).toHaveClass('text-qb-ai')
    expect(badge).toHaveClass('bg-qb-ai-bg')
  })

  it('draws a sparkline when a series is provided', () => {
    render(
      <dl>
        <KpiCard label="Pass rate" value="89%" icon={Play} sparkline={{ values: [70, 80, 75, 89], label: 'Pass rate over the last 4 runs' }} />
      </dl>,
    )

    expect(screen.getByRole('img', { name: 'Pass rate over the last 4 runs' })).toBeInTheDocument()
  })
})
