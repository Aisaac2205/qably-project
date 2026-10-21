import { afterEach, describe, expect, it, vi } from 'vitest'
import { docsUrl } from './docs-url'

describe('docsUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('falls back to a same-origin path when no docs origin is configured', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', '')
    expect(docsUrl('quickstart', 'es')).toBe('/docs/quickstart')
  })

  it('uses the English docs path for the English locale', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', '')
    expect(docsUrl('quickstart', 'en')).toBe('/en/docs/quickstart')
  })

  it('appends the anchor of a section of the page', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', '')
    expect(docsUrl('quickstart', 'es', 'step-4-report-ci')).toBe('/docs/quickstart#step-4-report-ci')
    expect(docsUrl('quickstart', 'en', 'step-4-report-ci')).toBe('/en/docs/quickstart#step-4-report-ci')
  })

  it('serves the overview at the docs root, not below it', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', '')
    expect(docsUrl('overview', 'es')).toBe('/docs')
    expect(docsUrl('overview', 'en')).toBe('/en/docs')
    expect(docsUrl('overview', 'en', 'getting-started')).toBe('/en/docs#getting-started')
  })

  it('prefixes the configured docs origin and tolerates a trailing slash', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', 'https://qably.example/')
    expect(docsUrl('quickstart', 'es', 'step-4-report-ci')).toBe(
      'https://qably.example/docs/quickstart#step-4-report-ci',
    )
    expect(docsUrl('quickstart', 'en', 'step-4-report-ci')).toBe(
      'https://qably.example/en/docs/quickstart#step-4-report-ci',
    )
    expect(docsUrl('api-keys', 'es')).toBe('https://qably.example/docs/api-keys')
  })

  it('does not add a fragment when the anchor is empty', () => {
    vi.stubEnv('NEXT_PUBLIC_DOCS_URL', '')
    expect(docsUrl('quickstart', 'es', '')).toBe('/docs/quickstart')
  })
})
