import { render, screen, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { DashboardWebhookChannel } from '@qably/types'
import { useI18nStore, type Locale } from '@/lib/i18n'
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
  beforeEach(() => {
    useI18nStore.setState({ locale: 'en' })
  })

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

  it('shows the webhook name without a subscribed-events line', () => {
    render(<ChannelRow webhook={webhook({ eventTypes: ['run_failed', 'run_completed'] })} />)
    expect(screen.getByText('Team Slack')).toBeInTheDocument()
    expect(screen.queryByText('Run failed, Run completed')).not.toBeInTheDocument()
  })

  it.each<[Locale, number, string, string]>([
    ['en', 1, '1 sent', 'sent'],
    ['en', 0, '0 sent', 'sent'],
    ['es', 1, '1 enviado', 'enviado'],
    ['es', 0, '0 enviados', 'enviados'],
  ])('announces the sent stat as one %s phrase for count %i, with "%s" as the visible unit', (locale, sent, phrase, unit) => {
    useI18nStore.setState({ locale })
    render(<ChannelRow webhook={webhook({ sent, failed: 2 })} />)

    const stat = screen.getByTestId('channel-sent-count')
    expect(within(stat).getByText(phrase, { selector: '.sr-only' })).toBeInTheDocument()
    expect(within(stat).getByText(unit)).toBeInTheDocument()
  })

  it.each<[Locale, number, string, string]>([
    ['en', 1, '1 failed', 'failed'],
    ['en', 0, '0 failed', 'failed'],
    ['es', 1, '1 fallido', 'fallido'],
    ['es', 0, '0 fallidos', 'fallidos'],
  ])('announces the failed stat as one %s phrase for count %i, with "%s" as the visible unit', (locale, failed, phrase, unit) => {
    useI18nStore.setState({ locale })
    render(<ChannelRow webhook={webhook({ sent: 12, failed })} />)

    const stat = screen.getByTestId('channel-failed-count')
    expect(within(stat).getByText(phrase, { selector: '.sr-only' })).toBeInTheDocument()
    expect(within(stat).getByText(unit)).toBeInTheDocument()
  })

  it('colours the failed value by fail tone when nonzero and pass tone at zero', () => {
    const { rerender } = render(<ChannelRow webhook={webhook({ sent: 12, failed: 2 })} />)
    expect(within(screen.getByTestId('channel-failed-count')).getByText('2')).toHaveClass('text-qb-fail')

    rerender(<ChannelRow webhook={webhook({ sent: 12, failed: 0 })} />)
    expect(within(screen.getByTestId('channel-failed-count')).getByText('0')).toHaveClass('text-qb-pass')
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
