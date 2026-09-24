import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OrganizationSummary } from '@qably/types'

const replace = vi.fn()
const refresh = vi.fn()
const signOut = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh, push: vi.fn() }),
  usePathname: () => '/dashboard',
}))

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: vi.fn(), social: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: (...args: unknown[]) => signOut(...args),
  },
  useSession: () => ({ data: { user: { id: 'user-1' } }, isPending: false }),
}))

vi.mock('@/features/organizations/hooks/use-organizations', () => ({ useOrganizations: vi.fn() }))
vi.mock('@/features/organizations/hooks/use-current-organization', () => ({
  useCurrentOrganization: vi.fn(),
}))

import { SidebarAccount } from '@/components/shell/sidebar-account'
import { useOrganizations } from '@/features/organizations/hooks/use-organizations'
import { useCurrentOrganization } from '@/features/organizations/hooks/use-current-organization'
import { useActiveOrganizationStore } from '@/stores/active-organization.store'

const useOrganizationsMock = vi.mocked(useOrganizations)
const useCurrentOrganizationMock = vi.mocked(useCurrentOrganization)

const acme: OrganizationSummary = {
  id: 'org-1',
  name: 'Acme QA Team',
  slug: 'acme-qa',
  plan: 'equipo',
  role: 'owner',
}

const globex: OrganizationSummary = {
  id: 'org-2',
  name: 'Globex Labs',
  slug: 'globex-labs',
  plan: 'gratuito',
  role: 'member',
}

function setOrganizations(organizations: OrganizationSummary[], current = organizations[0]) {
  useOrganizationsMock.mockReturnValue({
    organizations,
    isLoading: false,
    isError: false,
    error: null,
  })
  useCurrentOrganizationMock.mockReturnValue({
    organization: current,
    isLoading: false,
    isError: false,
    error: undefined,
  })
}

function renderAccount(collapsed = false) {
  const queryClient = new QueryClient()
  const result = render(
    <QueryClientProvider client={queryClient}>
      <SidebarAccount name="Isaac Flores" image={null} role="Admin" collapsed={collapsed} />
    </QueryClientProvider>,
  )
  return { queryClient, ...result }
}

beforeEach(() => {
  vi.clearAllMocks()
  setOrganizations([acme])
  useActiveOrganizationStore.setState({ organizationId: null, userId: null })
})

describe('SidebarAccount', () => {
  it('exposes the account card as a menu button without losing its identity', async () => {
    const { container } = await act(async () => renderAccount())

    const account = container.querySelector('[data-slot="sidebar-account"]')
    expect(account).toHaveClass('h-12', 'rounded-xl', 'border', 'border-border-sidebar')
    expect(account).toHaveTextContent('Isaac Flores')
    expect(account).toHaveTextContent('Admin')
    expect(account?.tagName).toBe('BUTTON')
    expect(account).toHaveAttribute('aria-haspopup')
  })

  it('ends the session and sends the browser to login without a way back', async () => {
    signOut.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    await act(async () => renderAccount())

    await user.click(screen.getByRole('button', { name: /Isaac Flores/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(refresh).toHaveBeenCalled()
  })

  it('keeps the user in place and explains why when sign out fails', async () => {
    signOut.mockResolvedValue({ data: null, error: { code: 'SESSION_EXPIRED' } })
    const user = userEvent.setup()
    await act(async () => renderAccount())

    await user.click(screen.getByRole('button', { name: /Isaac Flores/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your session expired. Sign in again.')
    expect(replace).not.toHaveBeenCalled()
  })

  it('still offers sign out when the sidebar is collapsed', async () => {
    await act(async () => renderAccount(true))

    const account = screen.getByRole('button', { name: /Isaac Flores/ })
    expect(account).toHaveAttribute('aria-haspopup')
    expect(account).toHaveTextContent('IF')
  })

  it('does not show an organization switcher for a single-organization account', async () => {
    setOrganizations([acme])
    const user = userEvent.setup()
    await act(async () => renderAccount())

    await user.click(screen.getByRole('button', { name: /Isaac Flores/ }))

    expect(await screen.findByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument()
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument()
  })

  it('lists every organization the user belongs to and marks the active one', async () => {
    setOrganizations([acme, globex], acme)
    const user = userEvent.setup()
    await act(async () => renderAccount())

    await user.click(screen.getByRole('button', { name: /Isaac Flores/ }))

    expect(await screen.findByRole('menuitemradio', { name: 'Acme QA Team' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Globex Labs' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('switching organizations persists the choice bound to the signed-in user, resets the query cache, and returns to the dashboard', async () => {
    setOrganizations([acme, globex], acme)
    const user = userEvent.setup()
    const { queryClient } = await act(async () => renderAccount())
    const resetSpy = vi.spyOn(queryClient, 'resetQueries')

    await user.click(screen.getByRole('button', { name: /Isaac Flores/ }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Globex Labs' }))

    await waitFor(() => expect(useActiveOrganizationStore.getState().organizationId).toBe('org-2'))
    expect(useActiveOrganizationStore.getState().userId).toBe('user-1')
    expect(resetSpy).toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/dashboard')
  })
})
