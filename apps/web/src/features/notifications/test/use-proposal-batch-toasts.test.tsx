import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Notification } from '@qably/types'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { useProposalBatchToasts } from '@/features/notifications/hooks/use-proposal-batch-toasts'
import { notificationKeys } from '@/features/notifications/lib/query-keys'
import {
  listNotifications,
  markNotificationRead,
} from '@/features/notifications/api/notifications.api'
import { useI18nStore } from '@/lib/i18n/store'

const { info, push, router } = vi.hoisted(() => {
  const push = vi.fn()
  return { info: vi.fn(), push, router: { push } }
})

vi.mock('@/lib/notify', () => ({ notify: { info } }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/features/notifications/api/notifications.api', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

const list = vi.mocked(listNotifications)
const markRead = vi.mocked(markNotificationRead)

function batch(id: string, overrides: Partial<Notification> = {}): Notification {
  return {
    id,
    organizationId: 'org-1',
    userId: 'user-1',
    eventType: 'proposals_ready',
    severity: 'medium',
    payload: {
      source: 'push',
      count: 18,
      projectId: 'proj-1',
      batchId: `batch-${id}`,
      commitSha: '518952c4e1a7',
      author: 'Ana Ruiz',
      branch: 'main',
    },
    createdAt: '2026-06-16T10:42:00Z',
    deliveries: [],
    ...overrides,
  }
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  // The list is read next to the hook so a test can tell when the first response landed.
  const view = renderHook(
    () => {
      useProposalBatchToasts()
      return useNotifications()
    },
    { wrapper: Wrapper },
  )

  // React Query hands results to React on a timer tick, so a poll is only
  // finished once that tick has passed and the hook has re-rendered.
  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
  }

  async function pollWith(next: Notification[]) {
    list.mockResolvedValue(next)
    await act(async () => {
      await client.refetchQueries({ queryKey: notificationKeys.all })
    })
    await settle()
  }

  return { client, view, pollWith, settle }
}

async function firstLoad(initial: Notification[]) {
  list.mockResolvedValue(initial)
  const harness = setup()
  await waitFor(() => expect(harness.view.result.current.hasLoaded).toBe(true))
  return harness
}

beforeEach(() => {
  vi.clearAllMocks()
  useI18nStore.setState({ locale: 'en' })
  markRead.mockResolvedValue(batch('x'))
})

describe('useProposalBatchToasts', () => {
  it('stays silent for the batches already waiting when the app opens', async () => {
    await firstLoad([batch('a'), batch('b')])

    expect(info).not.toHaveBeenCalled()
  })

  it('tells the person about a batch that arrives after the first load', async () => {
    const { pollWith } = await firstLoad([])

    await pollWith([batch('a')])

    expect(info).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith(
      '18 new proposals from push 518952c',
      expect.objectContaining({ id: 'a', description: 'main · Ana Ruiz' }),
    )
  })

  it('toasts a notification once, however many polls still return it', async () => {
    const { pollWith } = await firstLoad([])

    await pollWith([batch('a')])
    await pollWith([batch('a')])
    await pollWith([batch('a')])

    expect(info).toHaveBeenCalledTimes(1)
  })

  it('does not toast again when the backend recounts the same batch in place', async () => {
    const { pollWith } = await firstLoad([])
    await pollWith([batch('a')])

    await pollWith([batch('a', { payload: { ...batch('a').payload, count: 25 } })])

    expect(info).toHaveBeenCalledTimes(1)
  })

  it('toasts each new batch of a poll that brings several', async () => {
    const { pollWith } = await firstLoad([batch('old')])

    await pollWith([batch('old'), batch('a'), batch('b')])

    expect(info).toHaveBeenCalledTimes(2)
  })

  it('stays silent for a batch that is already read', async () => {
    const { pollWith } = await firstLoad([])

    await pollWith([batch('a', { readAt: '2026-06-16T10:50:00Z' })])

    expect(info).not.toHaveBeenCalled()
  })

  it('stays silent for notifications about anything else', async () => {
    const { pollWith } = await firstLoad([])

    await pollWith([
      batch('a', { eventType: 'run_failed', severity: 'critical', payload: { runName: '#1' } }),
    ])

    expect(info).not.toHaveBeenCalled()
  })

  it('does not replay the notifications of another organization after the cache is reset', async () => {
    const { client, settle } = await firstLoad([batch('a')])

    // The first response after a reset is a new baseline, whoever it belongs to.
    // It takes a moment to come back, as a network response does.
    list.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([batch('other-org')]), 20)),
    )
    await act(async () => {
      await client.resetQueries({ queryKey: notificationKeys.all })
    })
    await settle()
    expect(info).not.toHaveBeenCalled()

    expect(info).not.toHaveBeenCalled()
  })

  it('words the toast by where the proposals came from', async () => {
    const { pollWith } = await firstLoad([])

    await pollWith([
      batch('doc', { payload: { source: 'documentation', count: 12, projectId: 'proj-1', batchId: 'b1' } }),
      batch('chat', { payload: { source: 'chat', count: 1, projectId: 'proj-1', batchId: 'b2' } }),
    ])

    expect(info).toHaveBeenCalledWith('12 new proposals from documentation', expect.anything())
    expect(info).toHaveBeenCalledWith('1 new proposal from chat', expect.anything())
  })

  it('falls back to the plain event copy when a push carries no commit', async () => {
    const { pollWith } = await firstLoad([])

    await pollWith([
      batch('a', { payload: { source: 'push', count: 3, projectId: 'proj-1', batchId: 'b1' } }),
    ])

    expect(info).toHaveBeenCalledWith('3 proposals are ready for review.', expect.anything())
  })

  it('leaves the description out when a push names neither branch nor author', async () => {
    const { pollWith } = await firstLoad([])

    await pollWith([
      batch('a', {
        payload: { source: 'push', count: 3, projectId: 'proj-1', batchId: 'b1', commitSha: 'abcdef123' },
      }),
    ])

    const [, options] = info.mock.calls[0] as [string, Record<string, unknown>]
    expect(options).not.toHaveProperty('description')
  })

  it('writes the toast in the active language', async () => {
    useI18nStore.setState({ locale: 'es' })
    const { pollWith } = await firstLoad([])

    await pollWith([batch('a')])

    expect(info).toHaveBeenCalledWith(
      '18 propuestas nuevas del push 518952c',
      expect.objectContaining({ action: expect.objectContaining({ label: 'Ver' }) }),
    )
  })

  it('opens the batch in the review inbox and marks the notification read from the action', async () => {
    const { pollWith } = await firstLoad([])
    await pollWith([batch('a')])

    const [, options] = info.mock.calls[0] as [string, { action: { label: string; onClick: () => void } }]
    expect(options.action.label).toBe('View')
    act(() => options.action.onClick())

    expect(push).toHaveBeenCalledWith('/review-inbox?projectId=proj-1&batch=batch-a')
    await waitFor(() => expect(markRead).toHaveBeenCalledWith('a'))
  })

  it('offers no action when the batch cannot be traced to a project', async () => {
    const { pollWith } = await firstLoad([])

    await pollWith([
      batch('a', { payload: { source: 'chat', count: 2, batchId: 'b1' } }),
    ])

    const [, options] = info.mock.calls[0] as [string, Record<string, unknown>]
    expect(options).not.toHaveProperty('action')
  })
})
