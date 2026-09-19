import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SecretCard } from './secret-card'

describe('SecretCard', () => {
  it('renders the title, description and destructive action with an icon', () => {
    render(
      <SecretCard
        icon={<span aria-hidden="true">icon</span>}
        headingId="test-secret"
        title="Webhook secret"
        description="Used to verify webhook deliveries."
        action={{ label: 'Rotate secret', icon: <span aria-hidden="true">rotate-icon</span>, onClick: vi.fn() }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Webhook secret' })).toBeInTheDocument()
    expect(screen.getByText('Used to verify webhook deliveries.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rotate secret' })).toBeInTheDocument()
  })

  it('calls the action handler when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(
      <SecretCard
        icon={<span aria-hidden="true">icon</span>}
        headingId="test-secret"
        title="Webhook secret"
        description="Used to verify webhook deliveries."
        action={{ label: 'Rotate secret', icon: <span aria-hidden="true">rotate-icon</span>, onClick }}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Rotate secret' }))
    expect(onClick).toHaveBeenCalled()
  })

  it('surfaces an inline error with an alert role', () => {
    render(
      <SecretCard
        icon={<span aria-hidden="true">icon</span>}
        headingId="test-secret"
        title="Webhook secret"
        description="Used to verify webhook deliveries."
        action={{ label: 'Rotate secret', icon: <span aria-hidden="true">rotate-icon</span>, onClick: vi.fn() }}
        error="The secret could not be rotated. Try again."
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('The secret could not be rotated. Try again.')
  })
})
