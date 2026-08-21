import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@/features/auth/hooks/use-auth'

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
})

describe('useAuth', () => {
  it('signs in with the credentials the form collected', async () => {
    signInEmail.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth())

    let outcome
    await act(async () => {
      outcome = await result.current.login('qa@acme.test', 'longenoughpassword')
    })

    expect(signInEmail).toHaveBeenCalledWith({
      email: 'qa@acme.test',
      password: 'longenoughpassword',
    })
    expect(outcome).toEqual({ error: null })
  })

  it('turns an api error into copy the form can show', async () => {
    signInEmail.mockResolvedValue({
      data: null,
      error: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    })
    const { result } = renderHook(() => useAuth())

    let outcome
    await act(async () => {
      outcome = await result.current.login('qa@acme.test', 'wrongpassword12')
    })

    expect(outcome).toEqual({ error: 'Invalid email or password' })
  })

  it('reports a network failure instead of throwing at the form', async () => {
    signInEmail.mockRejectedValue(new TypeError('Failed to fetch'))
    const { result } = renderHook(() => useAuth())

    let outcome
    await act(async () => {
      outcome = await result.current.login('qa@acme.test', 'longenoughpassword')
    })

    expect(outcome).toEqual({
      error: 'Could not reach the Qably API. Check your connection and try again.',
    })
  })

  it('registers with the trimmed name', async () => {
    signUpEmail.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.register('qa@acme.test', 'longenoughpassword', 'Ada')
    })

    expect(signUpEmail).toHaveBeenCalledWith({
      email: 'qa@acme.test',
      password: 'longenoughpassword',
      name: 'Ada',
    })
  })

  it('sends the browser to GitHub and back to the given destination', async () => {
    signInSocial.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useAuth())

    await act(async () => {
      await result.current.signInWithGithub('/projects')
    })

    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'github',
      callbackURL: `${window.location.origin}/projects`,
    })
  })
})
