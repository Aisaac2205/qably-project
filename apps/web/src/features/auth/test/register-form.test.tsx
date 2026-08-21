import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RegisterForm } from '@/features/auth/components/register-form'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

async function renderForm() {
  await act(async () => {
    render(<RegisterForm />)
  })
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

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/projects'))
  })
})
