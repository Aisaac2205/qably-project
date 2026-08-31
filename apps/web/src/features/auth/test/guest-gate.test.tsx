import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSession } from '@/lib/auth-client'
import { GuestGate } from '@/features/auth/components/guest-gate'

const replace = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/auth-client', () => ({ useSession: vi.fn() }))

const readSession = vi.mocked(useSession)

function child() {
  return <div data-testid="login-form">Login form</div>
}

describe('GuestGate', () => {
  afterEach(() => {
    replace.mockReset()
    readSession.mockReset()
    window.history.replaceState({}, '', '/login')
  })

  it('renders the form for a signed-out visitor', async () => {
    readSession.mockReturnValue({ data: null, isPending: false } as never)

    await act(async () => {
      render(<GuestGate>{child()}</GuestGate>)
    })

    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })

  it('sends a signed-in user to the dashboard instead of the form', async () => {
    readSession.mockReturnValue({ data: { user: { id: 'user-1' } }, isPending: false } as never)

    await act(async () => {
      render(<GuestGate>{child()}</GuestGate>)
    })

    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/dashboard')
  })

  it('honours the route the signed-in user was originally sent away from', async () => {
    window.history.replaceState({}, '', '/login?next=%2Fprojects%2Fproj-1%2Frepository')
    readSession.mockReturnValue({ data: { user: { id: 'user-1' } }, isPending: false } as never)

    await act(async () => {
      render(<GuestGate>{child()}</GuestGate>)
    })

    expect(replace).toHaveBeenCalledWith('/projects/proj-1/repository')
  })

  it('holds the form back while the session is still resolving', async () => {
    readSession.mockReturnValue({ data: null, isPending: true } as never)

    await act(async () => {
      render(<GuestGate>{child()}</GuestGate>)
    })

    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
    expect(replace).not.toHaveBeenCalled()
  })
})
