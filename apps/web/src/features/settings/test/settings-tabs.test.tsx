import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Organization, OrgMember, ApiKey, GithubIntegration, AiProviderConnection } from '@qably/types'

const mockOrg: Organization = { id: 'org-1', name: 'Acme QA Team', slug: 'acme-qa', plan: 'pro', planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 } }
const mockMembers: OrgMember[] = []
const mockKeys: ApiKey[] = []
const mockIntegration: GithubIntegration = { webhookUrl: '', connected: false }
const mockAiProviders: AiProviderConnection[] = [
  { provider: 'claude', label: 'Claude', connected: false, model: 'claude-sonnet-4-20250514' },
  { provider: 'gemini', label: 'Gemini', connected: false, model: 'gemini-2.5-flash' },
]

vi.mock('@/lib/use-mock-store', () => ({
  useOrg: () => mockOrg,
  useMembers: () => mockMembers,
  useApiKeys: () => mockKeys,
  useIntegration: () => mockIntegration,
  useAiProviders: () => mockAiProviders,
}))

vi.mock('@/lib/mock-store', () => ({
  inviteMember: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
  updateIntegration: vi.fn(),
  connectAiProvider: vi.fn(),
  disconnectAiProvider: vi.fn(),
}))

import { SettingsTabs } from '../components/settings-tabs'

describe('SettingsTabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all tabs', async () => {
    await act(async () => { render(<SettingsTabs />) })
    expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /members/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /api keys/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /integrations/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /billing/i })).toBeInTheDocument()
  })

  it('shows General tab content by default', async () => {
    await act(async () => { render(<SettingsTabs />) })
    expect(screen.getAllByText('Acme QA Team').length).toBeGreaterThanOrEqual(1)
  })

  it('switches to Members tab on click', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<SettingsTabs />) })
    const membersTab = screen.getByRole('tab', { name: /members/i })
    await user.click(membersTab)
    // After switching, members section should be visible
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
  })

  it('switches to API Keys tab on click', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<SettingsTabs />) })
    const keysTab = screen.getByRole('tab', { name: /api keys/i })
    await user.click(keysTab)
    expect(screen.getByPlaceholderText(/key name/i)).toBeInTheDocument()
  })

  it('switches to Integrations tab on click', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<SettingsTabs />) })
    const intTab = screen.getByRole('tab', { name: /integrations/i })
    await user.click(intTab)
    expect(screen.getAllByText(/not connected/i).length).toBeGreaterThan(0)
  })
})
