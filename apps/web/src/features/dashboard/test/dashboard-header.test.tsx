import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DashboardHeader } from '@/features/dashboard/components/dashboard-header'

describe('DashboardHeader', () => {
  it('does not render a duplicate page title, since the app shell already shows it', () => {
    render(<DashboardHeader period={30} onPeriodChange={vi.fn()} />)
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('renders the subtitle as plain muted text, not a heading', () => {
    render(<DashboardHeader period={30} onPeriodChange={vi.fn()} />)
    const subtitle = screen.getByText('Track pass rate, activity and delivery health across every project.')
    expect(subtitle.tagName).toBe('P')
  })

  it('offers a 7/30/90 day period toggle group with 30 marked pressed by default', () => {
    render(<DashboardHeader period={30} onPeriodChange={vi.fn()} />)
    const group = screen.getByRole('group', { name: 'Time period' })
    expect(group).toBeInTheDocument()

    const button30 = screen.getByRole('button', { name: '30d' })
    expect(button30).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '90d' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onPeriodChange with the numeric period when a toggle is clicked', () => {
    const onPeriodChange = vi.fn()
    render(<DashboardHeader period={30} onPeriodChange={onPeriodChange} />)

    screen.getByRole('button', { name: '7d' }).click()
    expect(onPeriodChange).toHaveBeenCalledWith(7)

    screen.getByRole('button', { name: '90d' }).click()
    expect(onPeriodChange).toHaveBeenCalledWith(90)
  })

  it('caps content width with the dashboard token, never an arbitrary value', () => {
    const { container } = render(<DashboardHeader period={30} onPeriodChange={vi.fn()} />)
    expect(container.querySelector('.max-w-dashboard')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('max-w-[1128px]')
  })
})
