import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NotificationWebhook } from '@qably/types'
import { NotificationWebhooksPanel } from '@/features/integrations/components/notification-webhooks-panel'
import {
  useCreateNotificationWebhook,
  useDeleteNotificationWebhook,
  useTestNotificationWebhook,
  useUpdateNotificationWebhook,
} from '@/features/integrations/hooks/use-notification-webhook-mutations'
import { useNotificationWebhooks } from '@/features/integrations/hooks/use-notification-webhooks'
import { useCurrentOrganization } from '@/features/organizations/hooks/use-current-organization'

vi.mock('@/features/integrations/hooks/use-notification-webhooks', () => ({
  useNotificationWebhooks: vi.fn(),
}))
vi.mock('@/features/integrations/hooks/use-notification-webhook-mutations', () => ({
  useCreateNotificationWebhook: vi.fn(),
  useUpdateNotificationWebhook: vi.fn(),
  useDeleteNotificationWebhook: vi.fn(),
  useTestNotificationWebhook: vi.fn(),
}))
vi.mock('@/features/organizations/hooks/use-current-organization', () => ({
  useCurrentOrganization: vi.fn(),
}))

const useNotificationWebhooksMock = vi.mocked(useNotificationWebhooks)
const useCreateNotificationWebhookMock = vi.mocked(useCreateNotificationWebhook)
const useUpdateNotificationWebhookMock = vi.mocked(useUpdateNotificationWebhook)
const useDeleteNotificationWebhookMock = vi.mocked(useDeleteNotificationWebhook)
const useTestNotificationWebhookMock = vi.mocked(useTestNotificationWebhook)
const useCurrentOrganizationMock = vi.mocked(useCurrentOrganization)

const webhook: NotificationWebhook = {
  id: 'webhook-1',
  organizationId: 'org-1',
  type: 'slack',
  name: 'Team alerts',
  maskedUrl: 'hooks.slack.com/••••wxyz',
  enabled: true,
  eventTypes: ['run_failed'],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const createMutate = vi.fn()
const updateMutate = vi.fn()
const deleteMutate = vi.fn()
const testMutateAsync = vi.fn()

function setWebhooks(webhooks: NotificationWebhook[]) {
  useNotificationWebhooksMock.mockReturnValue({
    webhooks,
    isLoading: false,
    isError: false,
  })
}

function setRole(role: 'owner' | 'admin' | 'member') {
  useCurrentOrganizationMock.mockReturnValue({
    organization: { id: 'org-1', name: 'Acme', slug: 'acme', plan: 'equipo', role },
    isLoading: false,
    isError: false,
    error: undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setWebhooks([])
  setRole('owner')
  useCreateNotificationWebhookMock.mockReturnValue({
    mutate: createMutate,
    isPending: false,
    isError: false,
  } as never)
  useUpdateNotificationWebhookMock.mockReturnValue({
    mutate: updateMutate,
  } as never)
  useDeleteNotificationWebhookMock.mockReturnValue({
    mutate: deleteMutate,
  } as never)
  testMutateAsync.mockResolvedValue(undefined)
  useTestNotificationWebhookMock.mockReturnValue({
    mutateAsync: testMutateAsync,
  } as never)
})

describe('NotificationWebhooksPanel', () => {
  it('shows the empty state with an add action for an owner', async () => {
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    expect(screen.getByText('No team channels yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add channel' })).toBeInTheDocument()
  })

  it('shows a read-only empty state with no add action for a plain member', async () => {
    setRole('member')
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    expect(
      screen.getByText('No Slack or Discord channels are configured yet. Ask an owner or admin to add one.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add channel' })).not.toBeInTheDocument()
  })

  it('lists a webhook with its masked url, never the full url', async () => {
    setWebhooks([webhook])
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    expect(screen.getByText('Team alerts')).toBeInTheDocument()
    expect(screen.getByText('hooks.slack.com/••••wxyz')).toBeInTheDocument()
  })

  it('hides test, toggle and delete controls for a plain member', async () => {
    setWebhooks([webhook])
    setRole('member')
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    expect(screen.queryByRole('switch')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('opens a confirmation before deleting and calls the mutation on confirm', async () => {
    setWebhooks([webhook])
    const user = userEvent.setup()
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(deleteMutate).toHaveBeenCalledWith('webhook-1')
  })

  it('creates a webhook from the dialog form', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    await user.click(screen.getByRole('button', { name: 'Add channel' }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Name'), 'Team alerts')
    await user.type(
      within(dialog).getByLabelText('Webhook URL'),
      'https://hooks.slack.com/services/T00/B00/token',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Add channel' }))

    expect(createMutate).toHaveBeenCalledWith(
      {
        type: 'slack',
        name: 'Team alerts',
        url: 'https://hooks.slack.com/services/T00/B00/token',
        eventTypes: ['run_failed'],
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })
})
