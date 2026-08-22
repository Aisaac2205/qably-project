import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
}))

import { SidebarAccount } from '@/components/shell/sidebar-account'

function renderAccount(collapsed = false) {
  return render(
    <SidebarAccount name="Isaac F." role="Admin" initials="IF" collapsed={collapsed} />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SidebarAccount', () => {
  it('exposes the account card as a menu button without losing its identity', async () => {
    const { container } = await act(async () => renderAccount())

    const account = container.querySelector('[data-slot="sidebar-account"]')
    expect(account).toHaveClass('h-12', 'rounded-xl', 'border', 'border-border-sidebar')
    expect(account).toHaveTextContent('Isaac F.')
    expect(account).toHaveTextContent('Admin')
    expect(account?.tagName).toBe('BUTTON')
    expect(account).toHaveAttribute('aria-haspopup')
  })

  it('ends the session and sends the browser to login without a way back', async () => {
    signOut.mockResolvedValue({ data: {}, error: null })
    const user = userEvent.setup()
    await act(async () => renderAccount())

    await user.click(screen.getByRole('button', { name: /Isaac F\./ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    await waitFor(() => expect(signOut).toHaveBeenCalled())
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(refresh).toHaveBeenCalled()
  })

  it('keeps the user in place and explains why when sign out fails', async () => {
    signOut.mockResolvedValue({ data: null, error: { code: 'SESSION_EXPIRED' } })
    const user = userEvent.setup()
    await act(async () => renderAccount())

    await user.click(screen.getByRole('button', { name: /Isaac F\./ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Your session expired. Sign in again.')
    expect(replace).not.toHaveBeenCalled()
  })

  it('still offers sign out when the sidebar is collapsed', async () => {
    await act(async () => renderAccount(true))

    const account = screen.getByRole('button', { name: /Isaac F\./ })
    expect(account).toHaveAttribute('aria-haspopup')
    expect(account).toHaveTextContent('IF')
  })
})
