import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OrgMember } from '@qably/types'

const mockMembers: OrgMember[] = [
  { id: 'member-1', userId: 'user-1', name: 'Isaac Flores', email: 'isaac@acme.com', role: 'owner', joinedAt: '2026-01-10T00:00:00Z' },
  { id: 'member-2', userId: 'user-2', name: 'Sofia Vargas', email: 'sofia@acme.com', role: 'admin', joinedAt: '2026-02-14T00:00:00Z' },
  { id: 'member-3', userId: 'user-3', name: 'Martin Reyes', email: 'martin@acme.com', role: 'member', joinedAt: '2026-03-01T00:00:00Z' },
]

const mockInviteMember = vi.fn((..._args: unknown[]) => ({
  id: 'member-new',
  userId: 'user-new',
  name: 'newuser',
  email: 'new@acme.com',
  role: 'member' as const,
  joinedAt: new Date().toISOString(),
}))

vi.mock('@/lib/use-mock-store', () => ({
  useOrg: () => ({ id: 'org-1', name: 'Acme', slug: 'acme', plan: 'pro', planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 } }),
  useMembers: () => mockMembers,
  useApiKeys: () => [],
  useIntegration: () => ({ webhookUrl: '', connected: false }),
}))

vi.mock('@/lib/mock-store', () => ({
  inviteMember: (...args: any[]) => mockInviteMember(...args),
}))

import { MembersSection } from '../components/members-section'

describe('MembersSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows member names', async () => {
    await act(async () => { render(<MembersSection />) })
    expect(screen.getByText('Isaac Flores')).toBeInTheDocument()
    expect(screen.getByText('Sofia Vargas')).toBeInTheDocument()
    expect(screen.getByText('Martin Reyes')).toBeInTheDocument()
  })

  it('shows member emails', async () => {
    await act(async () => { render(<MembersSection />) })
    expect(screen.getByText('isaac@acme.com')).toBeInTheDocument()
  })

  it('shows role badges', async () => {
    await act(async () => { render(<MembersSection />) })
    expect(screen.getByText(/owner/i)).toBeInTheDocument()
    expect(screen.getByText(/admin/i)).toBeInTheDocument()
    expect(screen.getAllByText(/member/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows invite form with email input and role select', async () => {
    await act(async () => { render(<MembersSection />) })
    expect(screen.getByPlaceholderText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /invite/i })).toBeInTheDocument()
  })

  it('calls inviteMember on form submit', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<MembersSection />) })
    const emailInput = screen.getByPlaceholderText(/email/i)
    await user.type(emailInput, 'new@acme.com')
    const inviteBtn = screen.getByRole('button', { name: /invite/i })
    await user.click(inviteBtn)
    expect(mockInviteMember).toHaveBeenCalledWith({ email: 'new@acme.com', role: 'member' })
  })
})
