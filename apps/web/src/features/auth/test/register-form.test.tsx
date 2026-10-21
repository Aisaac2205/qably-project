import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegisterForm } from '@/features/auth/components/register-form'

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
  let view: ReturnType<typeof render> | undefined
  await act(async () => {
    view = render(<RegisterForm />)
  })
  return view as ReturnType<typeof render>
}

describe('RegisterForm', () => {
  it('renders the heading and supporting copy', async () => {
    await renderForm()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Create your account' }),
    ).toBeInTheDocument()
  })

  it('labels every credential input programmatically', async () => {
    await renderForm()

    expect(screen.getByLabelText('Name')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute(
      'type',
      'password',
    )
  })

  it('shares the GitHub affordance and separator with login', async () => {
    await renderForm()

    expect(screen.getByRole('button', { name: /Sign up with GitHub/ })).toBeInTheDocument()
    expect(screen.getByText('Or continue with')).toBeInTheDocument()
  })

  it('keeps GitHub as the only social sign-up, with no Bitbucket option', async () => {
    const { container } = await renderForm()

    expect(screen.queryByRole('button', { name: /Bitbucket/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument()
    expect(container.innerHTML).not.toMatch(/bitbucket/i)
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Create account',
      'Sign up with GitHub',
    ])
  })

  it('tabs through the fields, the submit button, GitHub and the sign in link in reading order', async () => {
    const user = userEvent.setup()
    await renderForm()

    const stops = [
      screen.getByLabelText('Name'),
      screen.getByLabelText('Email'),
      screen.getByLabelText('Password'),
      screen.getByLabelText('Confirm password'),
      screen.getByRole('button', { name: 'Create account' }),
      screen.getByRole('button', { name: 'Sign up with GitHub' }),
      screen.getByRole('link', { name: 'Sign in' }),
    ]

    for (const stop of stops) {
      await user.tab()
      expect(stop).toHaveFocus()
    }
  })

  it('links back to login', async () => {
    await renderForm()

    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('reports mismatched passwords without navigating', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'ada@acme.test')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.type(screen.getByLabelText('Confirm password'), 'differentpassword')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match')
    expect(push).not.toHaveBeenCalled()
  })

  it('requires a name before submitting', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Email'), 'ada@acme.test')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.type(screen.getByLabelText('Confirm password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(push).not.toHaveBeenCalled()
  })

  it('navigates to projects once every field is valid', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'ada@acme.test')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.type(screen.getByLabelText('Confirm password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard'))
  })

  it('registers against the api with the trimmed name', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Name'), '  Ada Lovelace  ')
    await user.type(screen.getByLabelText('Email'), 'qa@acme.test')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.type(screen.getByLabelText('Confirm password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await vi.waitFor(() =>
      expect(signUpEmail).toHaveBeenCalledWith({
        email: 'qa@acme.test',
        password: 'longenoughpassword',
        name: 'Ada Lovelace',
      }),
    )
  })

  it('shows a taken email without navigating', async () => {
    signUpEmail.mockResolvedValue({
      data: null,
      error: { code: 'USER_ALREADY_EXISTS' },
    })
    const user = userEvent.setup()
    await renderForm()

    await user.type(screen.getByLabelText('Name'), 'Ada')
    await user.type(screen.getByLabelText('Email'), 'qa@acme.test')
    await user.type(screen.getByLabelText('Password'), 'longenoughpassword')
    await user.type(screen.getByLabelText('Confirm password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email is already registered',
    )
    expect(push).not.toHaveBeenCalled()
  })

  it('starts the GitHub redirect when the GitHub button is pressed', async () => {
    const user = userEvent.setup()
    await renderForm()

    await user.click(screen.getByRole('button', { name: /Sign up with GitHub/ }))

    await vi.waitFor(() =>
      expect(signInSocial).toHaveBeenCalledWith({
        provider: 'github',
        callbackURL: `${window.location.origin}/dashboard`,
      }),
    )
  })
})
