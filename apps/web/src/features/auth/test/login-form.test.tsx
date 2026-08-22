import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginForm } from '@/features/auth/components/login-form'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const signInEmail = vi.fn()
const signUpEmail = vi.fn()
const signInSocial = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: {
      email: (...args: unknown[]) => signInEmail(...args),
      social: (...args: unknown[]) => signInSocial(...args),
    },
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  signInEmail.mockResolvedValue({ data: {}, error: null })
  signUpEmail.mockResolvedValue({ data: {}, error: null })
  signInSocial.mockResolvedValue({ data: {}, error: null })
})

async function renderForm() {
  await act(async () => {
    render(<LoginForm />)
  })
}

describe('LoginForm', () => {
  it('renders the heading and supporting copy', async () => {
    await renderForm()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Login to your account' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Enter your email below to login to your account'),
    ).toBeInTheDocument()
  })

  it('labels the email and password inputs programmatically', async () => {
    await renderForm()

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('offers the forgot password and sign up destinations', async () => {
    await renderForm()

    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/register',
    )
  })

  it('offers a GitHub button separated from the credential fields', async () => {
    await renderForm()

    expect(screen.getByRole('button', { name: /Login with GitHub/ })).toBeInTheDocument()
    expect(screen.getByText('Or continue with')).toBeInTheDocument()
  })

  it('reports an invalid email through an alert without navigating', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please enter a valid email address',
    )
    expect(push).not.toHaveBeenCalled()
  })

  it('marks the offending field with aria-invalid', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Email'), 'qa@acme.test')
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true')
  })

  it('navigates to the dashboard once both fields are valid', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Email'), 'qa@acme.test')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
  })

  it('signs in against the api with the credentials entered', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Email'), 'qa@acme.test')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    await vi.waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith({
        email: 'qa@acme.test',
        password: 'longenoughpassword',
      }),
    )
  })

  it('shows the api rejection and stays on the page', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    })
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Email'), 'qa@acme.test')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Login' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    )
    expect(push).not.toHaveBeenCalled()
  })

  it('starts the GitHub redirect when the GitHub button is pressed', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.click(screen.getByRole('button', { name: /Login with GitHub/ }))

    await vi.waitFor(() =>
      expect(signInSocial).toHaveBeenCalledWith({
        provider: 'github',
        callbackURL: `${window.location.origin}/dashboard`,
      }),
    )
  })
})
