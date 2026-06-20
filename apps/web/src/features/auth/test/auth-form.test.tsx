import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthForm } from '@/features/auth/components/auth-form'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

let resolveLogin: () => void
let resolveRegister: () => void
const mockLogin = vi.fn(() => new Promise<void>((r) => { resolveLogin = r }))
const mockRegister = vi.fn(() => new Promise<void>((r) => { resolveRegister = r }))
vi.mock('@/features/auth/hooks/use-auth-mock', () => ({
  useAuthMock: () => ({ login: mockLogin, register: mockRegister }),
}))

describe('AuthForm — login mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders email and password fields', async () => {
    await act(async () => {
      render(<AuthForm mode="login" />)
    })
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('shows errors on empty submit', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AuthForm mode="login" />)
    })
    await act(async () => {
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
    })
    // Empty email triggers "valid email" error, empty password triggers "at least 8 chars"
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it('shows email format error', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AuthForm mode="login" />)
    })
    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    await act(async () => {
      await user.type(emailInput, 'not-an-email')
      await user.type(passwordInput, 'longenough')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
    })
    expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument()
  })

  it('shows password too short error', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AuthForm mode="login" />)
    })
    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    await act(async () => {
      await user.type(emailInput, 'test@test.com')
      await user.type(passwordInput, 'short')
      await user.click(screen.getByRole('button', { name: 'Sign in' }))
    })
    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('shows loading state and navigates on success', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AuthForm mode="login" />)
    })
    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    await act(async () => {
      await user.type(emailInput, 'test@test.com')
      await user.type(passwordInput, 'longenough')
    })
    const button = screen.getByRole('button', { name: 'Sign in' })
    await act(async () => {
      await user.click(button)
    })
    // Button should show loading state while promise is pending
    expect(button).toBeDisabled()
    expect(screen.getByText('Signing in…')).toBeInTheDocument()

    // Resolve the pending promise
    await act(async () => {
      resolveLogin()
    })

    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects')
    })
  })
})

describe('AuthForm — register mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders name, email, password, and confirm password fields', async () => {
    await act(async () => {
      render(<AuthForm mode="register" />)
    })
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
  })

  it('shows password mismatch error', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AuthForm mode="register" />)
    })
    await act(async () => {
      await user.type(screen.getByLabelText('Name'), 'Test User')
      await user.type(screen.getByLabelText('Email'), 'test@test.com')
      await user.type(screen.getByLabelText('Password'), 'longenough')
      await user.type(screen.getByLabelText('Confirm password'), 'different')
      await user.click(screen.getByRole('button', { name: 'Create account' }))
    })
    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('navigates on successful register', async () => {
    const user = userEvent.setup()
    await act(async () => {
      render(<AuthForm mode="register" />)
    })
    await act(async () => {
      await user.type(screen.getByLabelText('Name'), 'Test User')
      await user.type(screen.getByLabelText('Email'), 'test@test.com')
      await user.type(screen.getByLabelText('Password'), 'longenough')
      await user.type(screen.getByLabelText('Confirm password'), 'longenough')
    })
    const button = screen.getByRole('button', { name: 'Create account' })
    await act(async () => {
      await user.click(button)
    })
    expect(screen.getByText('Creating account…')).toBeInTheDocument()

    await act(async () => {
      resolveRegister()
    })

    await vi.waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith('test@test.com', 'longenough', 'Test User')
    })
    await vi.waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/projects')
    })
  })
})
