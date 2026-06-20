'use client'

import { useCallback } from 'react'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

interface AuthMock {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
}

export function useAuthMock(): AuthMock {
  const login = useCallback(async (_email: string, _password: string) => {
    await delay(400)
  }, [])

  const register = useCallback(async (_email: string, _password: string, _name: string) => {
    await delay(400)
  }, [])

  return { login, register }
}
