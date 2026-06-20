import { render, screen, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TestTube } from '@phosphor-icons/react'
import { KpiCard } from '@/features/dashboard/components/kpi-card'

describe('KpiCard', () => {
  it('renders label', async () => {
    await act(async () => {
      render(<KpiCard label="Test Suites" value="31" icon={TestTube} />)
    })
    expect(screen.getByText('Test Suites')).toBeInTheDocument()
  })

  it('renders value', async () => {
    await act(async () => {
      render(<KpiCard label="Test Suites" value="31" icon={TestTube} />)
    })
    expect(screen.getByText('31')).toBeInTheDocument()
  })

  it('renders icon', async () => {
    await act(async () => {
      render(<KpiCard label="Projects" value="4" icon={TestTube} />)
    })
    // The card should have an svg (the icon)
    const svgs = document.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('renders trend with up arrow when positive', async () => {
    await act(async () => {
      render(
        <KpiCard
          label="Pass Rate"
          value="89%"
          icon={TestTube}
          trend={{ value: 5, label: 'vs prior 7d' }}
        />,
      )
    })
    // Should show the trend value
    expect(screen.getByText(/5%/)).toBeInTheDocument()
    expect(screen.getByText('vs prior 7d')).toBeInTheDocument()
  })

  it('renders trend with down arrow when negative', async () => {
    await act(async () => {
      render(
        <KpiCard
          label="Pass Rate"
          value="89%"
          icon={TestTube}
          trend={{ value: -3, label: 'vs prior 7d' }}
        />,
      )
    })
    expect(screen.getByText(/3%/)).toBeInTheDocument()
  })

  it('renders without trend section when trend not provided', async () => {
    await act(async () => {
      render(<KpiCard label="Projects" value="4" icon={TestTube} />)
    })
    expect(screen.queryByText(/vs prior/)).not.toBeInTheDocument()
  })
})
