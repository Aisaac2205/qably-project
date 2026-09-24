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
import { ApiError } from '@/lib/api-client'

vi.mock('@/features/integrations/hooks/use-notification-webhooks', () => ({
  useNotificationWebhooks: vi.fn(),
}))
vi.mock('@/features/integrations/hooks/use-notification-webhook-mutations', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/integrations/hooks/use-notification-webhook-mutations')>()
  return {
    ...actual,
    useCreateNotificationWebhook: vi.fn(),
    useUpdateNotificationWebhook: vi.fn(),
    useDeleteNotificationWebhook: vi.fn(),
    useTestNotificationWebhook: vi.fn(),
  }
})
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

function setRole(role: 'owner' | 'admin' | 'member', plan: 'gratuito' | 'equipo' | 'empresa' = 'equipo') {
  useCurrentOrganizationMock.mockReturnValue({
    organization: { id: 'org-1', name: 'Acme', slug: 'acme', plan, role },
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
    error: undefined,
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

  it('shows a clean brand logo next to each channel type, with no card wrapper', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    await user.click(screen.getByRole('button', { name: 'Add channel' }))
    const dialog = await screen.findByRole('dialog')

    const triggerLogo = dialog.querySelector('img[src*="slack.svg"]')
    expect(triggerLogo).not.toBeNull()
    expect(triggerLogo?.closest('[class*="rounded-xl"]')).toBeNull()
    expect(triggerLogo?.parentElement?.className).not.toMatch(/border|shadow|bg-surface/)

    await user.click(within(dialog).getByLabelText('Channel'))
    const discordOption = await screen.findByRole('option', { name: /Discord/ })
    const optionLogo = discordOption.querySelector('img[src*="discord.svg"]')
    expect(optionLogo).not.toBeNull()
    expect(optionLogo?.closest('[class*="rounded-xl"]')).toBeNull()
    expect(optionLogo?.parentElement?.className).not.toMatch(/border|shadow|bg-surface/)
  })

  it('shows an inline plan explanation instead of the add action on the free plan', async () => {
    setRole('owner', 'gratuito')
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    expect(screen.queryByRole('button', { name: 'Add channel' })).not.toBeInTheDocument()
    expect(
      screen.getByText('Notification channels are available on the Team and Enterprise plans.'),
    ).toBeInTheDocument()
  })

  it('still lists existing webhooks on the free plan', async () => {
    setRole('owner', 'gratuito')
    setWebhooks([webhook])
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    expect(screen.getByText('Team alerts')).toBeInTheDocument()
  })

  it('maps a plan-limit-reached create error to the same plan explanation', async () => {
    useCreateNotificationWebhookMock.mockReturnValue({
      mutate: createMutate,
      isPending: false,
      isError: true,
      error: new ApiError(403, 'nope', 'plan-limit-reached'),
    } as never)
    const user = userEvent.setup()
    await act(async () => {
      render(<NotificationWebhooksPanel />)
    })

    await user.click(screen.getByRole('button', { name: 'Add channel' }))
    const dialog = await screen.findByRole('dialog')

    expect(
      within(dialog).getByText(
        'Notification channels are available on the Team and Enterprise plans.',
      ),
    ).toBeInTheDocument()
  })
})
