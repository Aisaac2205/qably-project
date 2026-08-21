'use client'

import { useCallback } from 'react'
import { authClient } from '@/lib/auth-client'
import {
  NETWORK_AUTH_ERROR,
  type AuthClientError,
  toAuthMessage,
} from '@/features/auth/lib/auth-errors'

export interface AuthOutcome {
  error: string | null
}

interface AuthCall {
  error?: AuthClientError | null
}

export interface Auth {
  login: (email: string, password: string) => Promise<AuthOutcome>
  register: (email: string, password: string, name: string) => Promise<AuthOutcome>
  signInWithGithub: (destination: string) => Promise<AuthOutcome>
}

async function run(call: () => Promise<AuthCall>): Promise<AuthOutcome> {
  try {
    const { error } = await call()
    return { error: error ? toAuthMessage(error) : null }
  } catch {
    return { error: NETWORK_AUTH_ERROR }
  }
}

export function useAuth(): Auth {
  const login = useCallback(
    (email: string, password: string) =>
      run(() => authClient.signIn.email({ email, password })),
    [],
  )

  const register = useCallback(
    (email: string, password: string, name: string) =>
      run(() => authClient.signUp.email({ email, password, name })),
    [],
  )

  const signInWithGithub = useCallback(
    (destination: string) =>
      run(() =>
        authClient.signIn.social({
          provider: 'github',
          callbackURL: `${window.location.origin}${destination}`,
        }),
      ),
    [],
  )

  return { login, register, signInWithGithub }
}
