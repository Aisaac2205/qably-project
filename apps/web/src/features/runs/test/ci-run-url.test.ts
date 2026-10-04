import { describe, expect, it } from 'vitest'
import type { CiRunSummaryRecord, RunSource } from '@qably/types'
import { buildCiRunUrl } from '@/features/runs/lib/ci-run-url'

function ciRun(overrides: Partial<CiRunSummaryRecord> = {}): CiRunSummaryRecord {
  return {
    id: 'c1',
    projectId: 'proj-1',
    source: 'github_actions',
    externalId: '900',
    status: 'passing',
    startedAt: '2026-10-03T10:00:00.000Z',
    lastReportedAt: '2026-10-03T10:05:00.000Z',
    serverUrl: 'https://github.com',
    repository: 'acme/shop',
    ...overrides,
  }
}

describe('buildCiRunUrl', () => {
  it('links the run page of the repository on the server', () => {
    expect(buildCiRunUrl(ciRun())).toBe('https://github.com/acme/shop/actions/runs/900')
  })

  it('links a different run and a different repository', () => {
    expect(buildCiRunUrl(ciRun({ externalId: '12345', repository: 'qably/app' }))).toBe(
      'https://github.com/qably/app/actions/runs/12345',
    )
  })

  it('accepts a plain http server, as a self-hosted instance may use', () => {
    expect(buildCiRunUrl(ciRun({ serverUrl: 'http://ghe.internal' }))).toBe(
      'http://ghe.internal/acme/shop/actions/runs/900',
    )
  })

  it('keeps the port of the server', () => {
    expect(buildCiRunUrl(ciRun({ serverUrl: 'https://ghe.internal:8443' }))).toBe(
      'https://ghe.internal:8443/acme/shop/actions/runs/900',
    )
  })

  it('normalizes the scheme and the host to lowercase', () => {
    expect(buildCiRunUrl(ciRun({ serverUrl: 'HTTPS://GitHub.com' }))).toBe(
      'https://github.com/acme/shop/actions/runs/900',
    )
  })

  it('ignores surrounding whitespace in the stored values', () => {
    expect(
      buildCiRunUrl(ciRun({ serverUrl: ' https://github.com ', repository: ' acme/shop ', externalId: ' 900 ' })),
    ).toBe('https://github.com/acme/shop/actions/runs/900')
  })

  describe('keeps only the origin of the stored server URL', () => {
    it.each<[string, string, string]>([
      ['a trailing slash', 'https://github.com/', 'https://github.com'],
      ['a path', 'https://ghe.internal/some/path', 'https://ghe.internal'],
      ['credentials', 'https://user:pw@github.com', 'https://github.com'],
      ['a query string', 'https://github.com?token=abc', 'https://github.com'],
      ['a fragment', 'https://github.com#frag', 'https://github.com'],
      [
        'credentials, a path, a query string and a fragment',
        'https://user:pw@github.com/x?token=abc#frag',
        'https://github.com',
      ],
    ])('drops %s', (_label, serverUrl, origin) => {
      expect(buildCiRunUrl(ciRun({ serverUrl }))).toBe(`${origin}/acme/shop/actions/runs/900`)
    })

    it('never leaks a credential, a token or a fragment into the link', () => {
      const url = buildCiRunUrl(ciRun({ serverUrl: 'https://user:pw@github.com/x?token=abc#frag' }))

      expect(url).toBeDefined()
      expect(url).not.toContain('user')
      expect(url).not.toContain('pw')
      expect(url).not.toContain('token')
      expect(url).not.toContain('abc')
      expect(url).not.toContain('frag')
      expect(url).not.toContain('@')
    })
  })

  describe('refuses a server URL that is not http or https', () => {
    it.each<[string, string]>([
      ['a javascript URL', 'javascript:alert(1)'],
      ['a javascript URL in upper case', 'JAVASCRIPT:alert(1)'],
      ['a javascript URL behind whitespace', '  javascript:alert(1)'],
      ['an ftp URL', 'ftp://x'],
      ['a data URL', 'data:text/html,<script>alert(1)</script>'],
      ['a file URL', 'file:///etc/passwd'],
      ['a bare host', 'github.com'],
      ['a protocol-relative URL', '//github.com'],
      ['an empty string', ''],
      ['whitespace', '   '],
    ])('returns undefined for %s', (_label, serverUrl) => {
      expect(buildCiRunUrl(ciRun({ serverUrl }))).toBeUndefined()
    })
  })

  describe('returns undefined when a piece is missing', () => {
    it('has no server URL', () => {
      expect(buildCiRunUrl(ciRun({ serverUrl: undefined }))).toBeUndefined()
    })

    it.each<[string, string | undefined]>([
      ['absent', undefined],
      ['empty', ''],
      ['blank', '  '],
    ])('has a repository that is %s', (_label, repository) => {
      expect(buildCiRunUrl(ciRun({ repository }))).toBeUndefined()
    })

    it.each<[string, string]>([
      ['empty', ''],
      ['blank', '  '],
    ])('has an external id that is %s', (_label, externalId) => {
      expect(buildCiRunUrl(ciRun({ externalId }))).toBeUndefined()
    })
  })

  describe('only links runs that came from GitHub Actions', () => {
    it.each<[RunSource]>([['api'], ['manual']])('returns undefined for source %s', (source) => {
      expect(buildCiRunUrl(ciRun({ source }))).toBeUndefined()
    })

    it('links the same data once the source is github_actions', () => {
      expect(buildCiRunUrl(ciRun({ source: 'github_actions' }))).toBe(
        'https://github.com/acme/shop/actions/runs/900',
      )
    })
  })

  describe('encodes what it puts in the path', () => {
    it('encodes each repository segment on its own and keeps the slash between them', () => {
      expect(buildCiRunUrl(ciRun({ repository: 'my org/my shop' }))).toBe(
        'https://github.com/my%20org/my%20shop/actions/runs/900',
      )
    })

    it('does not let a repository end the path early', () => {
      expect(buildCiRunUrl(ciRun({ repository: 'acme/shop?x=1#y' }))).toBe(
        'https://github.com/acme/shop%3Fx%3D1%23y/actions/runs/900',
      )
    })

    it('does not let an external id open a new path segment or a query', () => {
      expect(buildCiRunUrl(ciRun({ externalId: '900/../x?y=1' }))).toBe(
        'https://github.com/acme/shop/actions/runs/900%2F..%2Fx%3Fy%3D1',
      )
    })
  })
})
