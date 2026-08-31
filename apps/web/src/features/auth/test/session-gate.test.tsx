import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '@/lib/auth-client'
import { SessionGate } from '@/features/auth/components/session-gate'

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

describe('SessionGate', () => {
  beforeEach(() => {
    pathname = '/projects/proj-1/repository'
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
})
