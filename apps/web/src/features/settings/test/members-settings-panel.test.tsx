import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrgMember } from '@qably/types'
import { MembersSettingsPanel } from '@/features/settings/components/members-settings-panel'
import { useMembers } from '@/features/organizations/hooks/use-members'
import { useInvites } from '@/features/organizations/hooks/use-invites'
import {
  useChangeMemberRole,
  useRemoveMember,
} from '@/features/organizations/hooks/use-member-mutations'
import {
  useCreateInvite,
  useResendInvite,
  useRevokeInvite,
} from '@/features/organizations/hooks/use-invite-mutations'
import { useCurrentOrganization } from '@/features/organizations/hooks/use-current-organization'
import { ApiError } from '@/lib/api-client'
import type { OrgInviteSummary } from '@/features/organizations/api/invites.api'

vi.mock('@/features/organizations/hooks/use-members', () => ({ useMembers: vi.fn() }))
vi.mock('@/features/organizations/hooks/use-invites', () => ({ useInvites: vi.fn() }))
vi.mock('@/features/organizations/hooks/use-member-mutations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/organizations/hooks/use-member-mutations')>()
  return {
    ...actual,
    useChangeMemberRole: vi.fn(),
    useRemoveMember: vi.fn(),
  }
})
vi.mock('@/features/organizations/hooks/use-invite-mutations', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/organizations/hooks/use-invite-mutations')>()
  return {
    ...actual,
    useCreateInvite: vi.fn(),
    useRevokeInvite: vi.fn(),
    useResendInvite: vi.fn(),
  }
})
vi.mock('@/features/organizations/hooks/use-current-organization', () => ({
  useCurrentOrganization: vi.fn(),
}))

const useMembersMock = vi.mocked(useMembers)
const useInvitesMock = vi.mocked(useInvites)
const useChangeMemberRoleMock = vi.mocked(useChangeMemberRole)
const useRemoveMemberMock = vi.mocked(useRemoveMember)
const useCreateInviteMock = vi.mocked(useCreateInvite)
const useRevokeInviteMock = vi.mocked(useRevokeInvite)
const useResendInviteMock = vi.mocked(useResendInvite)
const useCurrentOrganizationMock = vi.mocked(useCurrentOrganization)

const owner: OrgMember = {
  id: 'member-owner',
  userId: 'user-owner',
  name: 'Ada Lovelace',
  email: 'ada@acme.test',
  role: 'owner',
  joinedAt: '2026-01-01T00:00:00.000Z',
}

const member: OrgMember = {
  id: 'member-1',
  userId: 'user-1',
  name: 'Grace Hopper',
  email: 'grace@acme.test',
  role: 'member',
  joinedAt: '2026-01-02T00:00:00.000Z',
}

const invite: OrgInviteSummary = {
  id: 'invite-1',
  email: 'new@acme.test',
  role: 'member',
  createdAt: '2026-01-03T00:00:00.000Z',
  expiresAt: '2026-01-10T00:00:00.000Z',
  invitedByName: 'Ada Lovelace',
}

const changeRoleMutate = vi.fn()
const removeMemberMutate = vi.fn()
const createInviteMutate = vi.fn()
const revokeInviteMutate = vi.fn()
const resendInviteMutateAsync = vi.fn()

function setRole(role: 'owner' | 'admin' | 'member') {
  useCurrentOrganizationMock.mockReturnValue({
    organization: { id: 'org-1', name: 'Acme', slug: 'acme', plan: 'equipo', role },
    isLoading: false,
    isError: false,
    error: undefined,
  })
}

function setMembers(members: OrgMember[]) {
  useMembersMock.mockReturnValue({ members, isLoading: false, isError: false })
}

function setInvites(invites: OrgInviteSummary[]) {
  useInvitesMock.mockReturnValue({ invites, isLoading: false, isError: false })
}

beforeEach(() => {
  vi.clearAllMocks()
  setRole('owner')
  setMembers([owner, member])
  setInvites([])
  useChangeMemberRoleMock.mockReturnValue({
    mutate: changeRoleMutate,
    isPending: false,
  } as never)
  useRemoveMemberMock.mockReturnValue({
    mutate: removeMemberMutate,
    isPending: false,
  } as never)
  useCreateInviteMock.mockReturnValue({
    mutate: createInviteMutate,
    isPending: false,
  } as never)
  useRevokeInviteMock.mockReturnValue({
    mutate: revokeInviteMutate,
    isPending: false,
  } as never)
  resendInviteMutateAsync.mockResolvedValue(undefined)
  useResendInviteMock.mockReturnValue({
    mutateAsync: resendInviteMutateAsync,
    isPending: false,
  } as never)
})

describe('MembersSettingsPanel', () => {
  it('shows a no-permission state for a plain member instead of calling the api', async () => {
    setRole('member')
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    expect(useMembersMock).toHaveBeenCalledWith(false)
    expect(screen.getByText("You don't have permission to view this")).toBeInTheDocument()
  })

  it('lists members with their name, email and role', async () => {
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@acme.test')).toBeInTheDocument();
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
    expect(screen.getByText('grace@acme.test')).toBeInTheDocument();
  })

  it('lets an owner change a member role', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    const memberRow = screen.getByText('Grace Hopper').closest('li') as HTMLElement
    await user.click(within(memberRow).getByLabelText('Role'))
    await user.click(await screen.findByRole('option', { name: 'Admin' }))

    expect(changeRoleMutate).toHaveBeenCalledWith(
      { memberId: 'member-1', role: 'admin' },
      expect.anything(),
    )
  })

  it('hides the owner role option for an admin actor', async () => {
    setRole('admin')
    const user = userEvent.setup()
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    const memberRow = screen.getByText('Grace Hopper').closest('li') as HTMLElement
    await user.click(within(memberRow).getByLabelText('Role'))

    expect(screen.queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument()
  })

  it('does not let an admin actor touch an owner row', async () => {
    setRole('admin')
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    const ownerRow = screen.getByText('Ada Lovelace').closest('li') as HTMLElement
    expect(within(ownerRow).getByLabelText('Role')).toBeDisabled()
    expect(within(ownerRow).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('removes a member after confirmation', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    const memberRow = screen.getByText('Grace Hopper').closest('li') as HTMLElement
    await user.click(within(memberRow).getByRole('button', { name: 'Remove' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(removeMemberMutate).toHaveBeenCalledWith('member-1', expect.anything())
  })

  it('shows a clear message when removal is blocked by the last-owner rule', async () => {
    removeMemberMutate.mockImplementation((_id, options) => {
      options.onError(new ApiError(409, 'nope', 'last-owner-required'))
    })
    const user = userEvent.setup()
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    const ownerRow = screen.getByText('Ada Lovelace').closest('li') as HTMLElement
    await user.click(within(ownerRow).getByRole('button', { name: 'Remove' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }))

    expect(
      await screen.findByText('The organization must keep at least one owner'),
    ).toBeInTheDocument()
  })

  it('lists pending invites with the inviter name', async () => {
    setInvites([invite])
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    const inviteRow = screen.getByText('new@acme.test').closest('li') as HTMLElement
    expect(within(inviteRow).getByText('Ada Lovelace', { exact: false })).toBeInTheDocument()
  })

  it('revokes a pending invite', async () => {
    setInvites([invite])
    const user = userEvent.setup()
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    await user.click(screen.getByRole('button', { name: 'Revoke' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Revoke' }))

    expect(revokeInviteMutate).toHaveBeenCalledWith('invite-1')
  })

  it('resends a pending invite', async () => {
    setInvites([invite])
    const user = userEvent.setup()
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    await user.click(screen.getByRole('button', { name: 'Resend' }))

    expect(resendInviteMutateAsync).toHaveBeenCalledWith('invite-1')
  })

  it('invites a new member from the dialog form', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    await user.click(screen.getByRole('button', { name: 'Invite' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Email'), 'new@acme.test')
    await user.click(within(dialog).getByRole('button', { name: 'Invite' }))

    expect(createInviteMutate).toHaveBeenCalledWith(
      { email: 'new@acme.test', role: 'member' },
      expect.anything(),
    )
  })

  it('shows a seat-limit error from the invite dialog', async () => {
    createInviteMutate.mockImplementation((_payload, options) => {
      options.onError(new ApiError(403, 'nope', 'seat-limit-reached'))
    })
    const user = userEvent.setup()
    await act(async () => {
      render(<MembersSettingsPanel />)
    })

    await user.click(screen.getByRole('button', { name: 'Invite' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Email'), 'new@acme.test')
    await user.click(within(dialog).getByRole('button', { name: 'Invite' }))

    expect(
      await screen.findByText('This organization has reached the member limit for its plan'),
    ).toBeInTheDocument()
  })
})
