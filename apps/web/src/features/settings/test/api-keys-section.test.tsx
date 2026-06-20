import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ApiKey } from '@qably/types'

const mockKeys: ApiKey[] = [
  { id: 'key-1', name: 'CI/CD Pipeline', prefix: 'org_', lastFour: '4a2f', createdAt: '2026-04-01T00:00:00Z', lastUsedAt: '2026-06-18T14:22:00Z' },
  { id: 'key-2', name: 'Local Dev', prefix: 'org_', lastFour: 'b7c9', createdAt: '2026-05-15T00:00:00Z' },
]

const mockCreateKey = vi.fn((..._args: unknown[]) => ({
  id: 'key-new', name: 'Test Key', prefix: 'org_', lastFour: 'ffff', createdAt: new Date().toISOString(),
}))
const mockRevokeKey = vi.fn((..._args: unknown[]) => true)

vi.mock('@/lib/use-mock-store', () => ({
  useOrg: () => ({ id: 'org-1', name: 'Acme', slug: 'acme', plan: 'pro', planLimits: { maxProjects: 20, maxUsers: 10, maxCases: 5000 } }),
  useMembers: () => [],
  useApiKeys: () => mockKeys,
  useIntegration: () => ({ webhookUrl: '', connected: false }),
}))

vi.mock('@/lib/mock-store', () => ({
  createApiKey: (...args: any[]) => mockCreateKey(...args),
  revokeApiKey: (...args: any[]) => mockRevokeKey(...args),
}))

import { ApiKeysSection } from '../components/api-keys-section'

describe('ApiKeysSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows key names', async () => {
    await act(async () => { render(<ApiKeysSection />) })
    expect(screen.getByText('CI/CD Pipeline')).toBeInTheDocument()
    expect(screen.getByText('Local Dev')).toBeInTheDocument()
  })

  it('shows key last four digits', async () => {
    await act(async () => { render(<ApiKeysSection />) })
    expect(screen.getByText(/4a2f/)).toBeInTheDocument()
    expect(screen.getByText(/b7c9/)).toBeInTheDocument()
  })

  it('shows create form with name input', async () => {
    await act(async () => { render(<ApiKeysSection />) })
    expect(screen.getByPlaceholderText(/key name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument()
  })

  it('creates key on form submit', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<ApiKeysSection />) })
    const nameInput = screen.getByPlaceholderText(/key name/i)
    await user.type(nameInput, 'Test Key')
    const createBtn = screen.getByRole('button', { name: /create/i })
    await user.click(createBtn)
    expect(mockCreateKey).toHaveBeenCalledWith('Test Key')
  })

  it('shows revoke button for each key', async () => {
    await act(async () => { render(<ApiKeysSection />) })
    const revokeBtns = screen.getAllByRole('button', { name: /revoke/i })
    expect(revokeBtns.length).toBe(2)
  })

  it('calls revokeApiKey on revoke confirmation', async () => {
    const user = userEvent.setup()
    await act(async () => { render(<ApiKeysSection />) })
    const revokeBtns = screen.getAllByRole('button', { name: /revoke/i })
    await user.click(revokeBtns[0])
    // Confirm in dialog
    const confirmBtn = screen.getByRole('button', { name: 'Revoke' })
    await user.click(confirmBtn)
    expect(mockRevokeKey).toHaveBeenCalledWith('key-1')
  })
})
