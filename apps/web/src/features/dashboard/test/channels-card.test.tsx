import { render, screen, act, waitFor } from '@testing-library/react'
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

  it('shows the email row with its event types and no delivery counters', async () => {
    await act(async () => {
      renderWithQuery(<ChannelsCard />)
    })

    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Case regressed, Connection security')).toBeInTheDocument()
    expect(screen.queryByText('12')).toBeInTheDocument() // Team Slack sent total still present
  })

  it('hides the email row when every effective event type is disabled', async () => {
    getChannels.mockResolvedValue({
      ...dashboardChannelsFixture,
      email: { enabled: false, eventTypes: [] },
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

  it('shows the last delivery resolved to its webhook name', async () => {
    await act(async () => {
      renderWithQuery(<ChannelsCard />)
    })

    expect(screen.getByText(/Last delivery: sent to Team Slack/)).toBeInTheDocument()
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
      email: { enabled: false, eventTypes: [] },
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
