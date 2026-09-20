import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Notification, ProjectListItem } from '@qably/types'
import { NotificationsPage } from '@/features/notifications/components/notifications-page'
import { useNotifications } from '@/features/notifications/hooks/use-notifications'
import { useProjects } from '@/features/projects/hooks/use-projects'

vi.mock('@/features/notifications/hooks/use-notifications', () => ({
  useNotifications: vi.fn(),
}))

vi.mock('@/features/projects/hooks/use-projects', () => ({
  useProjects: vi.fn(),
}))

const useNotificationsMock = vi.mocked(useNotifications)
const useProjectsMock = vi.mocked(useProjects)

const markAsRead = vi.fn()
const markAllAsRead = vi.fn()

const project: ProjectListItem = {
  id: 'proj-1',
  name: 'Checkout',
  organizationId: 'org-1',
  technologies: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  suiteCount: 1,
  activity: null,
}

const runFailed: Notification = {
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

const connectionSecurity: Notification = {
  id: 'notification-2',
  organizationId: 'org-1',
  userId: 'user-1',
  eventType: 'connection_security',
  severity: 'high',
  payload: { action: 'Webhook secret rotated', connectionName: 'GitHub' },
  connectionId: 'conn-1',
  createdAt: '2026-06-14T09:12:00Z',
  readAt: '2026-06-14T10:00:00Z',
  deliveries: [],
}

function setNotifications(notifications: Notification[]) {
  useNotificationsMock.mockReturnValue({
    notifications,
    unreadCount: notifications.filter((n) => !n.readAt).length,
    isLoading: false,
    markAsRead,
    markAllAsRead,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useProjectsMock.mockReturnValue({
    projects: [project],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })
  setNotifications([runFailed, connectionSecurity])
})

describe('NotificationsPage', () => {
  it('does not render the KPI pill row', async () => {
    await act(async () => {
      render(<NotificationsPage />)
    })

    expect(screen.queryByText('1 unread')).not.toBeInTheDocument()
    expect(screen.queryByText(/^Critical: /)).not.toBeInTheDocument()
  })

  it('renders each notification message from the event catalog', async () => {
    await act(async () => {
      render(<NotificationsPage />)
    })

    expect(screen.getByText('The run "#12" in Checkout failed.')).toBeInTheDocument()
    expect(
      screen.getByText('Webhook secret rotated for connection GitHub.'),
    ).toBeInTheDocument()
  })

  it('links to the run for run_failed and renders no link for connection_security', async () => {
    await act(async () => {
      render(<NotificationsPage />)
    })

    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute(
      'href',
      '/projects/proj-1/runs/run-12',
    )
    expect(screen.queryAllByRole('link', { name: /view details/i })).toHaveLength(1)
  })

  it('marks an unread notification as read and shows no action for already-read ones', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<NotificationsPage />)
    })

    expect(screen.getAllByRole('button', { name: /mark as read/i })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /mark as read/i }))
    expect(markAsRead).toHaveBeenCalledWith('notification-1')
  })

  it('shows a clean logo, localized, when a notification was sent through a webhook channel', async () => {
    setNotifications([
      { ...runFailed, deliveries: [{ channel: 'discord', status: 'sent' }] },
      connectionSecurity,
    ])
    await act(async () => {
      render(<NotificationsPage />)
    })

    const article = screen.getByText('The run "#12" in Checkout failed.').closest('article')
    expect(article).not.toBeNull()
    const logo = within(article as HTMLElement).getByAltText('Sent to Discord')
    expect(logo).toHaveAttribute('src', expect.stringContaining('discord.svg'))
    expect(logo.closest('[class*="rounded-xl"]')).toBeNull()
    expect(logo.parentElement?.className).not.toMatch(/\bborder\b|bg-surface|shadow/)
    expect(logo.parentElement?.parentElement?.className).not.toMatch(
      /\bborder\b|bg-surface|shadow/,
    )
  })

  it('marks a failed delivery with a visible warning, not color alone', async () => {
    setNotifications([
      { ...runFailed, deliveries: [{ channel: 'slack', status: 'failed' }] },
      connectionSecurity,
    ])
    await act(async () => {
      render(<NotificationsPage />)
    })

    const article = screen.getByText('The run "#12" in Checkout failed.').closest('article')
    const logo = within(article as HTMLElement).getByAltText('Failed to send to Slack')
    expect(logo).toBeInTheDocument()
    expect(within(article as HTMLElement).getByTitle('Failed to send to Slack')).toBeInTheDocument()
    expect(logo.closest('[class*="rounded-xl"]')).toBeNull()
    expect(logo.parentElement?.className).not.toMatch(/\bborder\b|bg-surface|shadow/)
    const warningIcon = (article as HTMLElement).querySelector('svg')
    expect(warningIcon?.getAttribute('class') ?? '').not.toMatch(/\bborder\b|bg-surface|shadow/)
  })

  it('renders no delivery indicator when a notification has no webhook attempt', async () => {
    setNotifications([runFailed, connectionSecurity])
    await act(async () => {
      render(<NotificationsPage />)
    })

    const article = screen.getByText('The run "#12" in Checkout failed.').closest('article')
    expect((article as HTMLElement).querySelector('img[src*="/logos/"]')).toBeNull()
  })
})
