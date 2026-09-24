import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrganizationUsageRecord } from '@qably/types'
import { PlanUsageSection } from '@/features/settings/components/plan-usage-section'
import { useOrganizationUsage } from '@/features/organizations/hooks/use-organization-usage'

vi.mock('@/features/organizations/hooks/use-organization-usage', () => ({
  useOrganizationUsage: vi.fn(),
}))

const useOrganizationUsageMock = vi.mocked(useOrganizationUsage)

const teamUsage: OrganizationUsageRecord = {
  plan: 'equipo',
  limits: {
    members: 10,
    projects: 5,
    monthlyAiCredits: 300,
    notificationIntegrations: true,
  },
  members: 2,
  pendingInvites: 1,
  projects: 3,
  aiEnabled: true,
  aiCreditsUsed: 12,
  creditsResetAt: '2026-10-01T00:00:00.000Z',
}

const enterpriseUsage: OrganizationUsageRecord = {
  plan: 'empresa',
  limits: {
    members: 25,
    projects: null,
    monthlyAiCredits: 1000,
    notificationIntegrations: true,
  },
  members: 25,
  pendingInvites: 0,
  projects: 40,
  aiEnabled: true,
  aiCreditsUsed: 25,
  creditsResetAt: '2026-10-01T00:00:00.000Z',
}

const freeUsage: OrganizationUsageRecord = {
  plan: 'gratuito',
  limits: {
    members: 3,
    projects: 1,
    monthlyAiCredits: 25,
    notificationIntegrations: false,
  },
  members: 1,
  pendingInvites: 0,
  projects: 1,
  aiEnabled: true,
  aiCreditsUsed: 5,
  creditsResetAt: '2026-10-01T00:00:00.000Z',
}

function setUsage(usage: OrganizationUsageRecord | undefined, overrides: { isLoading?: boolean; isError?: boolean } = {}) {
  useOrganizationUsageMock.mockReturnValue({
    usage,
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setUsage(teamUsage)
})

describe('PlanUsageSection', () => {
  it('shows the real plan name and member/project usage fractions', async () => {
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.getByText('Team')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Members: 2 of 10 used' })).toHaveAttribute(
      'aria-valuenow',
      '20',
    )
    expect(screen.getByRole('progressbar', { name: 'Projects: 3 of 5 used' })).toHaveAttribute(
      'aria-valuenow',
      '60',
    )
  })

  it('shows unlimited projects without a progress bar when the plan limit is null', async () => {
    setUsage(enterpriseUsage)
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar', { name: /Projects:/ })).not.toBeInTheDocument()
    expect(screen.getByText('Projects: unlimited')).toBeInTheDocument()
  })

  it('shows Aeris credit usage and the reset date', async () => {
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.getByRole('progressbar', { name: 'Aeris credits this month: 12 of 300 used' })).toBeInTheDocument()
    expect(screen.getByText('Resets on October 1, 2026')).toBeInTheDocument()
  })

  it('lists only real shipped features, not fabricated ones', async () => {
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.getByText('JUnit ingestion from GitHub Actions and Bitbucket Pipelines')).toBeInTheDocument()
    expect(screen.getByText('Aeris case extraction and chat')).toBeInTheDocument()
    expect(screen.queryByText(/parallel suite execution/i)).not.toBeInTheDocument()
  })

  it('lists Slack and webhook notifications as included on a plan that has them', async () => {
    setUsage(teamUsage)
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.getByText('Slack and webhook notifications')).toBeInTheDocument()
  })

  it('drops Slack and webhook notifications from the included list on the free plan', async () => {
    setUsage(freeUsage)
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.queryByText('Slack and webhook notifications')).not.toBeInTheDocument()
  })

  it('never advertises a Spanish/English interface as a plan feature', async () => {
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.queryByText(/spanish.*english interface/i)).not.toBeInTheDocument()
  })

  it('renders no invoices, payment card, or upgrade/manage-subscription controls', async () => {
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(screen.queryByText(/4242/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /upgrade/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /manage subscription/i })).not.toBeInTheDocument()
  })

  it('shows a loading state while the usage query is pending', async () => {
    setUsage(undefined, { isLoading: true })
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows an error state when the usage query fails', async () => {
    setUsage(undefined, { isError: true })
    await act(async () => {
      render(<PlanUsageSection />)
    })

    expect(screen.getByText('Could not load your plan usage')).toBeInTheDocument()
  })
})
