import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import type { DashboardWebhookChannel } from '@qably/types'
import { ChannelRow } from '@/features/dashboard/components/channel-row'

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [k: string]: unknown }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />,
}))

function webhook(overrides: Partial<DashboardWebhookChannel>): DashboardWebhookChannel {
  return {
    id: 'webhook-1',
    type: 'slack',
    name: 'Team Slack',
    eventTypes: ['run_failed'],
    sent: 12,
    failed: 2,
    daily: [],
    ...overrides,
  }
}

describe('ChannelRow', () => {
  it('shows the official logo for the webhook type', () => {
    const { container } = render(<ChannelRow webhook={webhook({ type: 'slack' })} />)
    const image = container.querySelector('img')
    expect(image).toHaveAttribute('src', '/logos/slack.svg')
    expect(image).toHaveAttribute('alt', '')
  })

  it('shows the discord logo for a discord webhook', () => {
    const { container } = render(<ChannelRow webhook={webhook({ type: 'discord' })} />)
    expect(container.querySelector('img')).toHaveAttribute('src', '/logos/discord.svg')
  })

  it('shows the webhook name and its translated event types', () => {
    render(<ChannelRow webhook={webhook({ eventTypes: ['run_failed', 'run_completed'] })} />)
    expect(screen.getByText('Team Slack')).toBeInTheDocument()
    expect(screen.getByText('Run failed, Run completed')).toBeInTheDocument()
  })

  it('shows the sent and failed totals', () => {
    render(<ChannelRow webhook={webhook({ sent: 12, failed: 2 })} />)
    expect(within(screen.getByTestId('channel-sent-count')).getByText('12')).toBeInTheDocument()
    expect(within(screen.getByTestId('channel-failed-count')).getByText('2')).toBeInTheDocument()
  })

  it('renders the 14-day delivery bars', () => {
    const daily = Array.from({ length: 14 }, (_, index) => ({
      date: `2026-06-${String(index + 1).padStart(2, '0')}`,
      sent: 1,
      failed: 0,
    }))
    render(<ChannelRow webhook={webhook({ daily })} />)
    expect(screen.getByRole('img', { name: 'Team Slack deliveries over the last 14 days' })).toBeInTheDocument()
  })
})
