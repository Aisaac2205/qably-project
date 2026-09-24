import { act, render as rtlRender, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '@/lib/auth-client'
import { SessionGate } from '@/features/auth/components/session-gate'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'

const replace = vi.fn()
let pathname = '/projects/proj-1/repository'

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }))

const readSession = vi.mocked(useSession)

function child() {
  return <div data-testid="protected">Protected content</div>
}

function render(ui: React.ReactElement) {
  const queryClient = new QueryClient()
  const resetSpy = vi.spyOn(queryClient, 'resetQueries')
  const result = rtlRender(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  )
  return { ...result, queryClient, resetSpy }
}

describe('SessionGate', () => {
  beforeEach(() => {
    pathname = '/projects/proj-1/repository'
    useActiveOrganizationStore.setState({ organizationId: null, userId: null })
  })

  afterEach(() => {
    replace.mockReset()
    readSession.mockReset()
  })

  it('renders the protected content for a signed-in user', async () => {
    readSession.mockReturnValue({ data: { user: { id: 'user-1' } }, isPending: false } as never)

    await act(async () => {
      render(<SessionGate>{child()}</SessionGate>)
    })

    expect(screen.getByTestId('protected')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('sends a signed-out visitor to login and never renders the protected content', async () => {
    readSession.mockReturnValue({ data: null, isPending: false } as never)

    await act(async () => {
      render(<SessionGate>{child()}</SessionGate>)
    })

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith(
      '/login?next=%2Fprojects%2Fproj-1%2Frepository',
    )
  })

  it('holds the protected content back while the session is still resolving', async () => {
    readSession.mockReturnValue({ data: null, isPending: true } as never)

    await act(async () => {
      render(<SessionGate>{child()}</SessionGate>)
    })

    expect(screen.queryByTestId('protected')).not.toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('does not append a next parameter when the visitor lands on the dashboard', async () => {
    pathname = '/dashboard'
    readSession.mockReturnValue({ data: null, isPending: false } as never)

    await act(async () => {
      render(<SessionGate>{child()}</SessionGate>)
    })

    expect(replace).toHaveBeenCalledWith('/login')
  })

  it('clears a leftover active organization and resets the query cache when the session expires', async () => {
    useActiveOrganizationStore.setState({ organizationId: 'org-1', userId: 'user-1' })
    readSession.mockReturnValue({ data: null, isPending: false } as never)

    const { resetSpy } = await act(async () => render(<SessionGate>{child()}</SessionGate>))

    expect(useActiveOrganizationStore.getState().organizationId).toBeNull()
    expect(useActiveOrganizationStore.getState().userId).toBeNull()
    expect(resetSpy).toHaveBeenCalled()
  })

  it('leaves the active organization untouched for a signed-in user', async () => {
    useActiveOrganizationStore.setState({ organizationId: 'org-1', userId: 'user-1' })
    readSession.mockReturnValue({ data: { user: { id: 'user-1' } }, isPending: false } as never)

    await act(async () => {
      render(<SessionGate>{child()}</SessionGate>)
    })

    expect(useActiveOrganizationStore.getState().organizationId).toBe('org-1')
  })
})
