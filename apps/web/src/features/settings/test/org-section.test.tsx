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
    expect(screen.getAllByText('Acme QA Team').length).toBeGreaterThanOrEqual(1)
  })

  it('shows org slug', async () => {
    await act(async () => { render(<OrgSection />) })
    expect(screen.getByText('acme-qa')).toBeInTheDocument()
  })

  it('shows plan as a badge', async () => {
    await act(async () => { render(<OrgSection />) })
    expect(screen.getAllByText('pro').length).toBeGreaterThanOrEqual(1)
  })

  it('shows plan limits', async () => {
    await act(async () => { render(<OrgSection />) })
    expect(screen.getByText(/Up to 20 projects/i)).toBeInTheDocument()
    expect(screen.getByText(/Up to 10 team members/i)).toBeInTheDocument()
    expect(screen.getByText(/5,000/)).toBeInTheDocument()
  })

  it('has no editable fields for org name or slug', async () => {
    await act(async () => { render(<OrgSection />) })
    expect(screen.queryByPlaceholderText(/name/i)).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/slug/i)).not.toBeInTheDocument()
  })
})
