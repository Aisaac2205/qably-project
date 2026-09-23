import { screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

import { DashboardPage } from '@/features/dashboard/components/dashboard-page'
import { __resetStore } from '@/lib/mock-store'
import { renderWithQuery } from '@/lib/query-test-utils'
import { dashboardOverviewFixture, dashboardChannelsFixture } from '@/test/dashboard-api-stub'
import { getDashboardOverview, getDashboardChannels } from '@/features/dashboard/api/dashboard.api'

const originalResizeObserver = globalThis.ResizeObserver

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    <a href={href} {...props}>{children}</a>,
}))

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [k: string]: unknown }) =>
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />,
}))

vi.mock('@/features/dashboard/api/dashboard.api', () => ({
  getDashboardOverview: vi.fn(),
  getDashboardChannels: vi.fn(),
}))

const getOverview = vi.mocked(getDashboardOverview)
const getChannels = vi.mocked(getDashboardChannels)

describe('DashboardPage', () => {
  beforeEach(() => {
    __resetStore()
    getOverview.mockResolvedValue(dashboardOverviewFixture)
    getChannels.mockResolvedValue(dashboardChannelsFixture)
    // @ts-expect-error -- intentionally undefined for this suite
    delete globalThis.ResizeObserver
  })

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver
  })

  it('renders the header, hero, projects, gauge, channels and activity in that order', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })

    const region = screen.getByRole('region', { name: 'Dashboard' })
    const headings = Array.from(region.querySelectorAll('h1, h2, h3')).map((node) => node.textContent)

    expect(headings).toEqual([
      'Executed cases',
      'Projects',
      'Cases passing',
      'Notification channels',
      'Recent activity',
    ])
  })

  it('caps content width with the dashboard token everywhere, never an arbitrary value', async () => {
    const { container } = await act(async () => renderWithQuery(<DashboardPage />))
    expect(container.querySelectorAll('.max-w-dashboard').length).toBeGreaterThan(0)
    expect(container.innerHTML).not.toContain('max-w-[1128px]')
  })

  it('gives every dashboard row-grid child min-w-0 so charts can shrink inside their container', async () => {
    const { container } = await act(async () => renderWithQuery(<DashboardPage />))
    const grids = container.querySelectorAll('[data-testid="dashboard-row-grid"]')
    expect(grids.length).toBe(2)
    for (const grid of grids) {
      for (const child of grid.children) {
        expect(child).toHaveClass('min-w-0')
      }
    }
  })

  it('does not render the retired widgets it replaces', async () => {
    await act(async () => {
      renderWithQuery(<DashboardPage />)
    })

    expect(screen.queryByLabelText('Quality overview')).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Project status' })).not.toBeInTheDocument()
  })
})
