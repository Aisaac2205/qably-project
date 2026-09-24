import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRegisterForm } from '@/features/auth/hooks/use-register-form'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const signUpEmail = vi.fn()
const signInSocial = vi.fn()

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signUp: { email: (...args: unknown[]) => signUpEmail(...args) },
    signIn: { social: (...args: unknown[]) => signInSocial(...args) },
  },
}))

function setSearch(search: string) {
  window.history.pushState({}, '', `/register${search}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  signUpEmail.mockResolvedValue({ data: {}, error: null })
  signInSocial.mockResolvedValue({ data: {}, error: null })
  setSearch('')
})

afterEach(() => {
  setSearch('')
})

async function fillAndSubmit(result: { current: ReturnType<typeof useRegisterForm> }) {
  act(() => {
    result.current.setName('Ada Lovelace')
    result.current.setEmail('ada@acme.test')
    result.current.setPassword('longenoughpassword')
    result.current.setConfirmPassword('longenoughpassword')
  })
  await act(async () => {
    await result.current.submit()
  })
}

describe('useRegisterForm', () => {
  it('sends a fresh signup to the projects onboarding route by default', async () => {
    const { result } = renderHook(() => useRegisterForm())

    await fillAndSubmit(result)

    expect(push).toHaveBeenCalledWith('/projects')
  })

  it('returns to the invite it came from once registration succeeds', async () => {
    setSearch('?next=%2Finvite%2Ftok123')
    const { result } = renderHook(() => useRegisterForm())

    await fillAndSubmit(result)

    expect(push).toHaveBeenCalledWith('/invite/tok123')
  })

  it('carries the invite destination through the GitHub callback', async () => {
    setSearch('?next=%2Finvite%2Ftok123')
    const { result } = renderHook(() => useRegisterForm())

    await act(async () => {
      await result.current.continueWithGithub()
    })

    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'github',
      callbackURL: `${window.location.origin}/invite/tok123`,
    })
  })

  it('refuses an absolute next url and keeps the default onboarding route', async () => {
    setSearch('?next=https%3A%2F%2Fevil.test%2Fsteal')
    const { result } = renderHook(() => useRegisterForm())

    await fillAndSubmit(result)

    expect(push).toHaveBeenCalledWith('/projects')
  })
})
