import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Notification } from '@qably/types'
import { NotificationsMenu } from '@/features/notifications/components/notifications-menu'
import {
  listNotifications,
  markNotificationRead,
} from '@/features/notifications/api/notifications.api'
import { useI18nStore } from '@/lib/i18n/store'

vi.mock('@/features/notifications/api/notifications.api', () => ({
  listNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))

// Navigation itself belongs to Next; the row only has to point at the right
// href and report the click, so the anchor never leaves the test page.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string
    children: ReactNode
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void
    [key: string]: unknown
  }) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
      }}
    >
      {children}
    </a>
  ),
}))

const list = vi.mocked(listNotifications)
const markRead = vi.mocked(markNotificationRead)

const unread: Notification = {
  id: 'notification-1',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'run_failed',
  severity: 'critical',
  payload: { runName: '#12', suiteName: 'Checkout' },
  projectId: 'proj-1',
  runId: 'run-12',
  createdAt: '2026-06-16T10:42:00Z',
  deliveries: [],
}

const read: Notification = {
  ...unread,
  id: 'notification-2',
  eventType: 'case_regressed',
  severity: 'high',
  payload: { caseName: 'Discount total', suiteName: 'Checkout', runName: '#10' },
  readAt: '2026-06-14T10:00:00Z',
}

const proposalsReady: Notification = {
  id: 'notification-3',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'proposals_ready',
  severity: 'medium',
  payload: {
    source: 'push',
    count: 18,
    projectId: 'proj-1',
    batchId: 'batch-7',
    commitSha: '518952c4e1',
  },
  createdAt: '2026-06-16T11:00:00Z',
  deliveries: [],
}

const withoutDestination: Notification = {
  id: 'notification-4',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'connection_security',
  severity: 'low',
  payload: { action: 'created', connectionName: 'GitHub' },
  createdAt: '2026-06-16T09:00:00Z',
  deliveries: [],
}

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return render(<NotificationsMenu />, { wrapper: Wrapper })
}

async function openPanel(user: ReturnType<typeof userEvent.setup>, name = /notifications, \d+ unread/i) {
  await act(async () => {
    renderMenu()
  })
  await user.click(await screen.findByRole('button', { name }))
  return screen.findByRole('dialog')
}

beforeEach(() => {
  vi.clearAllMocks()
  list.mockResolvedValue([unread, read])
})

describe('NotificationsMenu', () => {
  it('shows unread notifications rendered from the event catalog', async () => {
    const user = userEvent.setup()
    const panel = await openPanel(user, /notifications, 1 unread/i)

    expect(await within(panel).findByText('The run "#12" in Checkout failed.')).toBeInTheDocument()
    expect(within(panel).getByText('Critical')).toBeInTheDocument()
  })

  it('opens the notification destination and marks it as read in one click', async () => {
    const user = userEvent.setup()
    markRead.mockResolvedValue({ ...unread, readAt: '2026-06-16T12:00:00Z' })
    await openPanel(user)

    const row = await screen.findByRole('link', { name: /failed\.$/ })
    expect(row).toHaveAttribute('href', '/projects/proj-1/runs/run-12')

    await user.click(row)

    expect(markRead).toHaveBeenCalledWith('notification-1')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('links a proposals_ready notification to its batch in the review inbox', async () => {
    const user = userEvent.setup()
    list.mockResolvedValue([proposalsReady])
    await openPanel(user)

    const row = await screen.findByRole('link', { name: /18 proposals are ready for review/ })

    expect(row).toHaveAttribute('href', '/review-inbox?projectId=proj-1&batch=batch-7')
  })

  it('keeps an unread notification without a destination as a button that only marks it read', async () => {
    const user = userEvent.setup()
    list.mockResolvedValue([withoutDestination])
    markRead.mockResolvedValue({ ...withoutDestination, readAt: '2026-06-16T12:00:00Z' })
    await openPanel(user)

    expect(screen.queryByRole('link', { name: /GitHub/ })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /Connection GitHub was created/ }))

    expect(markRead).toHaveBeenCalledWith('notification-4')
  })

  it('does not mark an already read notification again when it is opened', async () => {
    const user = userEvent.setup()
    await openPanel(user)

    await user.click(screen.getByRole('tab', { name: /^read/i }))
    await user.click(await screen.findByRole('link', { name: /regressed in Checkout/ }))

    expect(markRead).not.toHaveBeenCalled()
  })

  it('names each row with its read state, severity and message, leaving the dot decorative', async () => {
    const user = userEvent.setup()
    const panel = await openPanel(user)

    const row = await within(panel).findByRole('link', { name: /failed\.$/ })

    expect(row).toHaveAccessibleName('Unread, Critical, The run "#12" in Checkout failed.')
    expect(row.querySelector('[aria-label="Unread"]')).toBeNull()
    expect(row.querySelector('[aria-hidden="true"].rounded-full')).not.toBeNull()
  })

  it('switches between unread and read tabs that own their tabpanel', async () => {
    const user = userEvent.setup()
    const panel = await openPanel(user)
    expect(await within(panel).findByText('The run "#12" in Checkout failed.')).toBeInTheDocument()

    const unreadTab = within(panel).getByRole('tab', { name: /^unread/i })
    const panelOfUnread = within(panel).getByRole('tabpanel')
    expect(unreadTab).toHaveAttribute('aria-controls', panelOfUnread.id)
    expect(panelOfUnread).toHaveAttribute('aria-labelledby', unreadTab.id)

    await user.click(within(panel).getByRole('tab', { name: /^read/i }))

    expect(
      await within(panel).findByText('Discount total regressed in Checkout during run "#10".'),
    ).toBeInTheDocument()
    expect(within(panel).queryByText('The run "#12" in Checkout failed.')).not.toBeInTheDocument()
  })

  it('moves between the tabs with the arrow keys', async () => {
    const user = userEvent.setup()
    const panel = await openPanel(user)
    const unreadTab = await within(panel).findByRole('tab', { name: /^unread/i })

    act(() => unreadTab.focus())
    await user.keyboard('{ArrowRight}')
    const readTab = within(panel).getByRole('tab', { name: /^read/i })
    expect(readTab).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(readTab).toHaveAttribute('aria-selected', 'true')
  })

  it('closes on Escape and gives focus back to the bell', async () => {
    const user = userEvent.setup()
    await openPanel(user)

    await user.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: /notifications, 1 unread/i })).toHaveFocus()
  })

  it('reaches mark all as read and every row with the Tab key', async () => {
    const user = userEvent.setup()
    list.mockResolvedValue([unread, withoutDestination])
    const panel = await openPanel(user, /notifications, 2 unread/i)
    await within(panel).findByRole('link', { name: /failed\.$/ })

    // Opening moves focus into the panel, so the walk starts from wherever it landed.
    const reached: string[] = []
    function note() {
      const focused = document.activeElement
      if (focused instanceof HTMLElement) {
        reached.push(focused.getAttribute('aria-label') ?? focused.textContent ?? '')
      }
    }
    note()
    for (let step = 0; step < 8; step += 1) {
      await user.tab()
      note()
    }

    expect(reached.some((name) => /mark all as read/i.test(name))).toBe(true)
    expect(reached.some((name) => /Critical, The run/.test(name))).toBe(true)
    expect(reached.some((name) => /Connection GitHub was created/.test(name))).toBe(true)
  })

  it('closes when the user goes on to the full notifications page', async () => {
    const user = userEvent.setup()
    await openPanel(user)

    await user.click(await screen.findByRole('link', { name: /view details/i }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('translates the trigger, the severity labels and the empty read state', async () => {
    const user = userEvent.setup()
    useI18nStore.setState({ locale: 'es' })
    const panel = await openPanel(user, /notificaciones, 1 sin leer/i)

    expect(await within(panel).findByText('Crítica')).toBeInTheDocument()

    await user.click(within(panel).getByRole('tab', { name: /^leídas/i }))
    expect(await within(panel).findByText(/Discount total/)).toBeInTheDocument()
  })

  it('says there are no read notifications in the active language', async () => {
    const user = userEvent.setup()
    list.mockResolvedValue([unread])
    const panel = await openPanel(user)

    await user.click(within(panel).getByRole('tab', { name: /^read/i }))

    expect(await within(panel).findByText('No read notifications')).toBeInTheDocument()
  })
})
