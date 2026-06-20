import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { GithubIntegration } from '@qably/types'

const mockUpdateIntegration = vi.fn()

// These must be defined before vi.mock since vi.mock is hoisted
const connectedState: GithubIntegration = {
  webhookUrl: 'https://api.qably.io/webhooks/github/org-1',
  connected: true,
  repoUrl: 'https://github.com/acme/ecommerce-app',
}

let currentIntegration = { ...connectedState }

vi.mock('@/lib/use-mock-store', () => ({
  useOrg: () => ({ id: 'org-1', name: 'Acme', slug: 'acme', plan: 'pro', planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 } }),
  useMembers: () => [],
  useApiKeys: () => [],
  useIntegration: () => currentIntegration,
}))

vi.mock('@/lib/mock-store', () => ({
  updateIntegration: (...args: any[]) => mockUpdateIntegration(...args),
}))

import { IntegrationsSection } from '../components/integrations-section'

describe('IntegrationsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows webhook URL', async () => {
    await act(async () => { render(<IntegrationsSection />) })
    expect(screen.getByText(/webhooks\/github\/org-1/)).toBeInTheDocument()
  })

  it('shows connected status badge', async () => {
    await act(async () => { render(<IntegrationsSection />) })
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  it('shows repo URL', async () => {
    await act(async () => { render(<IntegrationsSection />) })
    expect(screen.getByText(/github\.com\/acme\/ecommerce-app/)).toBeInTheDocument()
  })

  it('has disconnect button when connected', async () => {
    await act(async () => { render(<IntegrationsSection />) })
    expect(screen.getByRole('button', { name: /disconnect/i })).toBeInTheDocument()
  })

  it('calls updateIntegration on disconnect', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<IntegrationsSection />) })
    const btn = screen.getByRole('button', { name: /disconnect/i })
    await user.click(btn)
    expect(mockUpdateIntegration).toHaveBeenCalledWith({ connected: false })
  })
})
