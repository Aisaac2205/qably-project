import { render as rtlRender, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { Notification, OrganizationSummary } from '@qably/types'
import { AppShell } from '@/components/shell/app-shell'
import { QueryProvider } from '@/providers/query-provider'
import { useOrganizations } from '@/features/organizations/hooks/use-organizations'
import { useCurrentOrganization } from '@/features/organizations/hooks/use-current-organization'
import { listNotifications } from '@/features/notifications/api/notifications.api'
import { notificationKeys } from '@/features/notifications/lib/query-keys'
import { getRegisteredQueryClient } from '@/lib/query-client-registry'
import { notify } from '@/lib/notify'

function render(ui: React.ReactElement) {
  return rtlRender(ui, { wrapper: QueryProvider })
}

vi.mock('@/features/projects/hooks/use-project', async () => {
  const { getProject } = await import('@/lib/mock-store')
  return {
    useProject: (id: string) => ({
      project: getProject(id),
      isLoading: false,
      isError: false,
    }),
  }
})

vi.mock('@/lib/notify', () => ({ notify: { info: vi.fn() } }))
vi.mock('@/features/review-inbox/api/review.api', () => ({
  getInboxCounts: vi.fn(async () => ({
    byStatus: { in_review: 0, approved: 0, rejected: 0, changes_requested: 0 },
    version: 'test-version',
  })),
}))
vi.mock('@/features/notifications/api/notifications.api', () => ({
  listNotifications: vi.fn(async () => []),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}))
vi.mock('@/features/organizations/hooks/use-organizations', () => ({ useOrganizations: vi.fn() }))
vi.mock('@/features/organizations/hooks/use-current-organization', () => ({
  useCurrentOrganization: vi.fn(),
}))

const useOrganizationsMock = vi.mocked(useOrganizations)
const useCurrentOrganizationMock = vi.mocked(useCurrentOrganization)

const singleOrganization: OrganizationSummary = {
  id: 'org-1',
  name: 'Acme QA Team',
  slug: 'acme-qa',
  plan: 'equipo',
  role: 'owner',
}

beforeEach(() => {
  useOrganizationsMock.mockReturnValue({
    organizations: [singleOrganization],
    isLoading: false,
    isError: false,
    error: null,
  })
  useCurrentOrganizationMock.mockReturnValue({
    organization: singleOrganization,
    isLoading: false,
    isError: false,
    error: undefined,
  })
})


vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useParams: () => ({}),
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }),
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn().mockResolvedValue({ data: {}, error: null }),
  },
  useSession: () => ({
    data: { user: { name: 'Ana Ruiz', image: null } },
    isPending: false,
  }),
}))

describe('AppShell', () => {
  it('opens the sidebar in the state the user left it', async () => {
    await act(async () => {
      render(
        <AppShell defaultSidebarOpen={false}>
          <p>Content</p>
        </AppShell>,
      )
    })
    expect(document.querySelector('[data-slot="sidebar"][data-state]')).toHaveAttribute('data-state', 'collapsed')
  })

  it('bounds the shell to the viewport so page columns scroll inside main, not the document', async () => {
    await act(async () => {
      render(
        <AppShell>
          <p>Content</p>
        </AppShell>,
      )
    })
    const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]')
    expect(wrapper).not.toBeNull()
    expect(wrapper).toHaveClass('h-dvh')
    expect(wrapper).not.toHaveClass('min-h-dvh')
  })

  it('restores the scroll position of main when history traverses back to an entry', async () => {
    window.history.replaceState({}, '', '/dashboard?range=week')
    await act(async () => {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>,
      )
    })
    const main = screen.getByRole('main')
    let top = 0
    Object.defineProperty(main, 'clientHeight', { configurable: true, get: () => 600 })
    Object.defineProperty(main, 'scrollHeight', { configurable: true, get: () => 3000 })
    Object.defineProperty(main, 'scrollTop', {
      configurable: true,
      get: () => top,
      set: (value: number) => {
        top = value
      },
    })
    main.scrollTo = vi.fn((options?: ScrollToOptions | number) => {
      if (typeof options === 'object' && options.top !== undefined) top = options.top
    }) as unknown as typeof main.scrollTo

    top = 700
    main.dispatchEvent(new Event('scroll'))
    window.history.pushState({}, '', '/dashboard?range=month')
    top = 0
    window.history.replaceState({}, '', '/dashboard?range=week')
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(main.scrollTo).toHaveBeenCalledWith({ top: 700, behavior: 'instant' })
    window.history.replaceState({}, '', '/')
  })

  it('renders children', async () => {
    await act(async () => {
      render(
        <AppShell>
          <div data-testid="content">Content</div>
        </AppShell>
      )
    })
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('renders sidebar', async () => {
    await act(async () => {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      )
    })
    expect(screen.getByRole('navigation', { name: /sidebar/i })).toBeInTheDocument()
  })

  it('renders top bar', async () => {
    await act(async () => {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>
      )
    })
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('keeps the workspace on one flat surface, divided from the sidebar by a hairline border', async () => {
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    )

    expect(container.querySelector('[data-slot="sidebar"]')).toHaveAttribute('data-variant', 'sidebar')
    expect(container.querySelector('[data-slot="sidebar-wrapper"]')).toHaveClass('bg-surface')
    expect(container.querySelector('[data-slot="sidebar-inset"]')).toHaveClass(
      'bg-surface',
      'md:border-l',
      'md:border-border',
    )
    expect(screen.getByRole('main')).toHaveClass('bg-surface', 'overflow-auto')
    expect(screen.getByRole('main')).not.toHaveClass('md:rounded-2xl', 'md:ring-1', 'md:shadow-pop')
  })

  it('starts keyboard order with a visible-on-focus skip link and one main landmark', async () => {
    const user = userEvent.setup()
    render(<AppShell><p>Content</p></AppShell>)

    await user.tab()

    const skipLink = screen.getByRole('link', { name: 'Skip to main content' })
    expect(skipLink).toHaveFocus()
    expect(skipLink).toHaveAttribute('href', '#main-content')
    expect(screen.getAllByRole('main')).toHaveLength(1)
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content')
  })

  it('focuses main content when the skip link is activated by keyboard', async () => {
    const user = userEvent.setup()
    render(<AppShell><p>Content</p></AppShell>)

    await user.tab()
    await user.keyboard('{Enter}')

    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('announces a new proposal batch with exactly one toast, however many bells the shell holds', async () => {
    const newBatch: Notification = {
      id: 'notification-1',
      organizationId: 'org-1',
      userId: 'user-1',
      eventType: 'proposals_ready',
      severity: 'medium',
      payload: { source: 'push', count: 18, projectId: 'proj-1', batchId: 'batch-1', commitSha: '518952c4e1' },
      createdAt: '2026-06-16T10:42:00Z',
      deliveries: [],
    }
    vi.mocked(notify.info).mockClear()
    vi.mocked(listNotifications).mockResolvedValue([])

    await act(async () => {
      render(
        <AppShell>
          <div>Content</div>
        </AppShell>,
      )
    })
    await waitFor(() =>
      expect(getRegisteredQueryClient()?.getQueryData(notificationKeys.all)).toEqual([]),
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    vi.mocked(listNotifications).mockResolvedValue([newBatch])
    await act(async () => {
      await getRegisteredQueryClient()?.refetchQueries({ queryKey: notificationKeys.all })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    await waitFor(() => expect(notify.info).toHaveBeenCalledTimes(1))
    expect(notify.info).toHaveBeenCalledWith(
      '18 new proposals from push 518952c',
      expect.objectContaining({ id: 'notification-1' }),
    )
  })
})
