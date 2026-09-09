import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { HealthSignalChip } from '@/features/projects/suites/components/health-signal-chip'

describe('HealthSignalChip', () => {
  it('renders a visible label as its accessible name, not color alone', async () => {
    render(<HealthSignalChip signal="flaky" />)

    expect(screen.getByRole('button', { name: /flaky/i })).toBeInTheDocument()
  })

  it('renders the count alongside the label when given', async () => {
    render(<HealthSignalChip signal="flaky" count={3} />)

    const trigger = screen.getByRole('button', { name: /flaky/i })
    expect(trigger).toHaveTextContent('3')
  })

  it('reveals the practice explanation on keyboard focus', async () => {
    const user = userEvent.setup()
    render(<HealthSignalChip signal="raw-name" />)

    await user.tab()

    expect(
      await screen.findByText(/rename it into something a non-engineer can read/i),
    ).toBeInTheDocument()
  })
})
