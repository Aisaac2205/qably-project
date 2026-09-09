import { afterEach, describe, expect, it, vi } from 'vitest'
import { docsUrl } from './docs-url'

describe('docsUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to a same-origin path when no docs origin is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', '')
    expect(docsUrl('step-4-report-ci', 'es')).toBe('/docs#step-4-report-ci')
  })

  it('uses the English docs path for the English locale', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', '')
    expect(docsUrl('step-4-report-ci', 'en')).toBe('/en/docs#step-4-report-ci')
  })

  it('prefixes the configured docs origin and tolerates a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', 'https://qably.example/')
    expect(docsUrl('step-4-report-ci', 'es')).toBe('https://qably.example/docs#step-4-report-ci')
    expect(docsUrl('step-4-report-ci', 'en')).toBe('https://qably.example/en/docs#step-4-report-ci')
  })
})
