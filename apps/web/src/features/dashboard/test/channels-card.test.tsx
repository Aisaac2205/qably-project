import { render, screen, act, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClientProvider } from '@tanstack/react-query'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery, createTestQueryClient } from '@/lib/query-test-utils'
import { dashboardKeys } from '@/features/dashboard/lib/query-keys'
import { dashboardChannelsFixture } from '@/test/dashboard-api-stub'
import { getDashboardChannels } from '@/features/dashboard/api/dashboard.api'
import { getBrowserTimeZone } from '@/lib/time-zone'
import { ChannelsCard } from '@/features/dashboard/components/channels-card'

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [k: string]: unknown }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />,
}))

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardChannels: vi.fn(),
}))

const getChannels = vi.mocked(getDashboardChannels)

describe('ChannelsCard', () => {
  beforeEach(() => {
    __resetStore()
    getChannels.mockResolvedValue(dashboardChannelsFixture)
  })

  it('titles the section with an h2 under the page h1', async () => {
    await act(async () => {
      renderWithQuery(<ChannelsCard />)
    })

    expect(screen.getByRole('heading', { level: 2, name: 'Notification channels' })).toBeInTheDocument()
  })

  it('renders one row per enabled webhook', async () => {
    await act(async () => {
      renderWithQuery(<ChannelsCard />)
    })

    expect(screen.getByText('Team Slack')).toBeInTheDocument()
    expect(screen.getByText('QA Alerts')).toBeInTheDocument()
  })

  it('shows the email row with its event types, sent/failed counters and 14-day delivery bars, like every other channel row', async () => {
    await act(async () => {
      renderWithQuery(<ChannelsCard />)
    })

    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Case regressed, Connection security')).toBeInTheDocument()
    const sentCounts = screen.getAllByTestId('channel-sent-count').map((el) => el.textContent)
    const failedCounts = screen.getAllByTestId('channel-failed-count').map((el) => el.textContent)
    expect(sentCounts).toContain('12 sent')
    expect(failedCounts).toContain('1 failed')
    expect(
      screen.getByRole('img', { name: 'Email deliveries over the last 14 days' }),
    ).toBeInTheDocument()
  })

  it('hides the email row when every effective event type is disabled', async () => {
    getChannels.mockResolvedValue({
      ...dashboardChannelsFixture,
      email: { enabled: false, eventTypes: [], sent: 0, failed: 0, daily: [] },
    })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.channels(getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ChannelsCard />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(screen.getByText('Team Slack')).toBeInTheDocument())
    expect(screen.queryByText('Email')).not.toBeInTheDocument()
  })

  it('renders the built-in in-app notifications row with its sent and unread counts', async () => {
    await act(async () => {
      renderWithQuery(<ChannelsCard />)
    })

    expect(screen.getByText('Qably')).toBeInTheDocument()
    expect(screen.getByTestId('in-app-sent-count')).toHaveTextContent('9 sent')
    expect(screen.getByTestId('in-app-unread-count')).toHaveTextContent('3 unread')
  })

  it('uses the Qably app icon, decorative, for the in-app row', async () => {
    const { container } = await act(async () => renderWithQuery(<ChannelsCard />))

    const icons = within(container).getAllByAltText('')
    expect(icons.some((icon) => icon.getAttribute('src')?.includes('icono-qably'))).toBe(true)
  })

  it('treats the card as empty only when webhooks, email and in-app notifications are all empty', async () => {
    getChannels.mockResolvedValue({
      webhooks: [],
      email: { enabled: false, eventTypes: [], sent: 0, failed: 0, daily: [] },
      inApp: { sent: 0, unread: 0, daily: [] },
      lastDelivery: null,
    })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.channels(getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ChannelsCard />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No channels configured')).toBeInTheDocument()
  })

  it('shows the last delivery resolved to its webhook name', async () => {
    await act(async () => {
      renderWithQuery(<ChannelsCard />)
    })

    expect(screen.getByText(/Last delivery: sent to Team Slack/)).toBeInTheDocument()
  })

  it('pins the last-delivery footer to the bottom of the card regardless of row count', async () => {
    const { container } = await act(async () => renderWithQuery(<ChannelsCard />))

    const card = container.querySelector('[aria-labelledby="channels-card-heading"]')
    expect(card).toHaveClass('flex', 'h-full', 'flex-col')

    const rowList = card?.querySelector('.divide-y')
    expect(rowList).toHaveClass('flex-grow')

    const footer = screen.getByText(/Last delivery:/).closest('div')
    expect(footer).toHaveClass('mt-auto')
  })

  it('shows a loading state while channels load', async () => {
    getChannels.mockReturnValue(new Promise(() => {}))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.channels(getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ChannelsCard />
      </QueryClientProvider>,
    )

    expect(screen.queryByText('Team Slack')).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('shows an error state with retry when channels fail to load', async () => {
    getChannels.mockRejectedValue(new Error('network down'))
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.channels(getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ChannelsCard />
      </QueryClientProvider>,
    )

    const alert = await screen.findByRole('alert')
    expect(alert).toBeInTheDocument()

    getChannels.mockResolvedValueOnce(dashboardChannelsFixture)
    const retryButton = screen.getByRole('button', { name: 'Retry' })
    await act(async () => {
      retryButton.click()
    })

    await waitFor(() => expect(screen.getByText('Team Slack')).toBeInTheDocument())
  })

  it('shows an empty state when there are no webhooks and email is disabled', async () => {
    getChannels.mockResolvedValue({
      webhooks: [],
      email: { enabled: false, eventTypes: [], sent: 0, failed: 0, daily: [] },
      inApp: { sent: 0, unread: 0, daily: [] },
      lastDelivery: null,
    })
    const client = createTestQueryClient()
    client.removeQueries({ queryKey: dashboardKeys.channels(getBrowserTimeZone()) })

    render(
      <QueryClientProvider client={client}>
        <ChannelsCard />
      </QueryClientProvider>,
    )

    expect(await screen.findByText('No channels configured')).toBeInTheDocument()
  })
})
