import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DashboardHeader } from '@/features/dashboard/components/dashboard-header'

describe('DashboardHeader', () => {
  it('renders the dashboard title and subtitle', () => {
    render(<DashboardHeader period={30} onPeriodChange={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(
      screen.getByText('Track pass rate, activity and delivery health across every project.'),
    ).toBeInTheDocument()
  })

  it('offers a 7/30/90 day period control with 30 marked selected by default', () => {
    render(<DashboardHeader period={30} onPeriodChange={vi.fn()} />)
    const group = screen.getByRole('tablist', { name: 'Time period' })
    expect(group).toBeInTheDocument()

    const tab30 = screen.getByRole('tab', { name: '30d' })
    expect(tab30).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '7d' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getByRole('tab', { name: '90d' })).toHaveAttribute('aria-selected', 'false')
  })

  it('calls onPeriodChange with the numeric period when a tab is clicked', () => {
    const onPeriodChange = vi.fn()
    render(<DashboardHeader period={30} onPeriodChange={onPeriodChange} />)

    screen.getByRole('tab', { name: '7d' }).click()
    expect(onPeriodChange).toHaveBeenCalledWith(7)

    screen.getByRole('tab', { name: '90d' }).click()
    expect(onPeriodChange).toHaveBeenCalledWith(90)
  })

  it('supports arrow-key navigation between period tabs', () => {
    const onPeriodChange = vi.fn()
    render(<DashboardHeader period={30} onPeriodChange={onPeriodChange} />)

    const tab30 = screen.getByRole('tab', { name: '30d' })
    tab30.focus()
    const group = screen.getByRole('tablist', { name: 'Time period' })
    group.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(onPeriodChange).toHaveBeenCalledWith(90)
  })

  it('caps content width with the dashboard token, never an arbitrary value', () => {
    const { container } = render(<DashboardHeader period={30} onPeriodChange={vi.fn()} />)
    expect(container.querySelector('.max-w-dashboard')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('max-w-[1128px]')
  })
})
