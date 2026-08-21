import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveApiBaseUrl } from '@/lib/api-base-url'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('resolveApiBaseUrl', () => {
  it('returns the configured api origin', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:3001')

    expect(resolveApiBaseUrl()).toBe('http://localhost:3001')
  })

  it('drops a trailing slash and any path so it matches the api origin', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.qably.app/api/auth/')

    expect(resolveApiBaseUrl()).toBe('https://api.qably.app')
  })

  it('throws naming the variable when it is missing', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '')

    expect(() => resolveApiBaseUrl()).toThrow(/NEXT_PUBLIC_API_URL/)
  })

  it('throws when the value is not a url', () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'localhost:3001')

    expect(() => resolveApiBaseUrl()).toThrow(/NEXT_PUBLIC_API_URL/)
  })
})
