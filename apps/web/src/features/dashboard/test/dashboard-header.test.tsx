import userEvent from '@testing-library/user-event'
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

  it('offers a 7/30/90 day period dropdown with the selected period displayed', () => {
    render(<DashboardHeader period={7} onPeriodChange={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Time period' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('7 days')
  })

  it('calls onPeriodChange with the numeric period when an option is selected', async () => {
    const user = userEvent.setup()
    const onPeriodChange = vi.fn()
    render(<DashboardHeader period={7} onPeriodChange={onPeriodChange} />)

    const trigger = screen.getByRole('button', { name: 'Time period' })
    await user.click(trigger)

    const option30 = await screen.findByRole('option', { name: '30 days' })
    await user.click(option30)
    expect(onPeriodChange).toHaveBeenCalledWith(30)
  })

  it('caps content width with the dashboard token, never an arbitrary value', () => {
    const { container } = render(<DashboardHeader period={30} onPeriodChange={vi.fn()} />)
    expect(container.querySelector('.max-w-dashboard')).toBeInTheDocument()
    expect(container.innerHTML).not.toContain('max-w-[1128px]')
  })
})
