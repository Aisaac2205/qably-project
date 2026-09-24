import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { InvitePreviewRecord } from '@qably/types'
import { InviteAcceptView } from '@/features/organizations/components/invite-accept-view'
import { useInvitePreview } from '@/features/organizations/hooks/use-invite-preview'
import { useAcceptInvite } from '@/features/organizations/hooks/use-accept-invite'
import { useSession } from '@/lib/auth-client'
import { applyOrganizationChange } from '@/lib/organization-context'

vi.mock('@/features/organizations/hooks/use-invite-preview', () => ({
  useInvitePreview: vi.fn(),
}))
vi.mock('@/features/organizations/hooks/use-accept-invite', () => ({
  useAcceptInvite: vi.fn(),
}))
vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }))
vi.mock('@/lib/organization-context', () => ({ applyOrganizationChange: vi.fn() }))

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

const useInvitePreviewMock = vi.mocked(useInvitePreview)
const useAcceptInviteMock = vi.mocked(useAcceptInvite)
const useSessionMock = vi.mocked(useSession)
const applyOrganizationChangeMock = vi.mocked(applyOrganizationChange)

const pendingPreview: InvitePreviewRecord = {
  organizationName: 'Acme QA',
  inviterName: 'Ada Lovelace',
  email: 'new@acme.test',
  role: 'member',
  status: 'pending',
}

const acceptMutateAsync = vi.fn()

function renderView(token: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <InviteAcceptView token={token} />
    </QueryClientProvider>,
  )
}

function setPreview(preview: InvitePreviewRecord | undefined, isError = false) {
  useInvitePreviewMock.mockReturnValue({
    preview,
    isLoading: false,
    isError,
  } as never)
}

function setSession(email: string | null) {
  useSessionMock.mockReturnValue({
    data: email ? { user: { id: 'user-1', email } } : null,
    isPending: false,
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  setPreview(pendingPreview)
  setSession(null)
  acceptMutateAsync.mockResolvedValue({ organizationId: 'org-2' })
  useAcceptInviteMock.mockReturnValue({
    mutateAsync: acceptMutateAsync,
    isPending: false,
  } as never)
})

describe('InviteAcceptView', () => {
  it('shows the not-found state when the token does not resolve to an invite', async () => {
    setPreview(undefined, true)
    await act(async () => {
      renderView('bad-token')
    })

    expect(screen.getByText('This invite link is no longer valid')).toBeInTheDocument()
  })

  it('shows the expired state', async () => {
    setPreview({ ...pendingPreview, status: 'expired' })
    await act(async () => {
      renderView('tok123')
    })

    expect(screen.getByText('This invite has expired')).toBeInTheDocument()
  })

  it('shows the already-used state', async () => {
    setPreview({ ...pendingPreview, status: 'accepted' })
    await act(async () => {
      renderView('tok123')
    })

    expect(screen.getByText('This invite was already used')).toBeInTheDocument()
  })

  it('shows the revoked state', async () => {
    setPreview({ ...pendingPreview, status: 'revoked' })
    await act(async () => {
      renderView('tok123')
    })

    expect(screen.getByText('This invite was revoked')).toBeInTheDocument()
  })

  it('prompts a signed-out visitor to sign in or register, carrying the invite as next', async () => {
    await act(async () => {
      renderView('tok123')
    })

    expect(screen.getByText('Acme QA', { exact: false })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in to accept' })).toHaveAttribute(
      'href',
      '/login?next=%2Finvite%2Ftok123',
    )
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/register?next=%2Finvite%2Ftok123',
    )
  })

  it('shows a mismatch message when the signed-in email differs from the invite', async () => {
    setSession('someone-else@acme.test')
    await act(async () => {
      renderView('tok123')
    })

    expect(screen.getByText('This invite is for a different email')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept invite' })).not.toBeInTheDocument()
  })

  it('accepts the invite for a matching signed-in user and switches into the organization', async () => {
    setSession('new@acme.test')
    const user = userEvent.setup()
    await act(async () => {
      renderView('tok123')
    })

    await user.click(screen.getByRole('button', { name: 'Accept invite' }))

    expect(acceptMutateAsync).toHaveBeenCalledWith('tok123')
    await vi.waitFor(() =>
      expect(applyOrganizationChangeMock).toHaveBeenCalledWith(expect.anything(), {
        organizationId: 'org-2',
        userId: 'user-1',
      }),
    )
    expect(replace).toHaveBeenCalledWith('/dashboard')
  })

  it('shows an inline error when accepting loses a race to expiry', async () => {
    const { ApiError } = await import('@/lib/api-client')
    acceptMutateAsync.mockRejectedValue(new ApiError(410, 'nope', 'invite-expired'))
    setSession('new@acme.test')
    const user = userEvent.setup()
    await act(async () => {
      renderView('tok123')
    })

    await user.click(screen.getByRole('button', { name: 'Accept invite' }))

    expect(await screen.findByText('This invite has expired')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
