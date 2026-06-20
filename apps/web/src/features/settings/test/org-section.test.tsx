import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Organization } from '@qably/types'

const mockOrg: Organization = {
  id: 'org-1',
  name: 'Acme QA Team',
  slug: 'acme-qa',
  plan: 'pro',
  planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 },
}

vi.mock('@/lib/use-mock-store', () => ({
  useOrg: () => mockOrg,
  useMembers: () => [],
  useApiKeys: () => [],
  useIntegration: () => ({ webhookUrl: '', connected: false }),
}))

import { OrgSection } from '../components/org-section'

describe('OrgSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows org name', async () => {
    await act(async () => { render(<OrgSection />) })
    expect(screen.getByText('Acme QA Team')).toBeInTheDocument()
  })

  it('shows org slug', async () => {
    await act(async () => { render(<OrgSection />) })
    expect(screen.getByText('acme-qa')).toBeInTheDocument()
  })

  it('shows plan as a badge', async () => {
    await act(async () => { render(<OrgSection />) })
    expect(screen.getByText('pro', { exact: true })).toBeInTheDocument()
  })

  it('shows plan limits', async () => {
    await act(async () => { render(<OrgSection />) })
    expect(screen.getByText(/20/)).toBeInTheDocument()
    expect(screen.getByText(/10/)).toBeInTheDocument()
    expect(screen.getByText(/5000/)).toBeInTheDocument()
  })

  it('renders in read-only mode (no inputs)', async () => {
    await act(async () => { render(<OrgSection />) })
    const inputs = document.querySelectorAll('input')
    expect(inputs.length).toBe(0)
  })
})
