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

const GITHUB_ORIGIN = 'https://github.com'
const LONE_SURROGATE = String.fromCharCode(0xd800)
const SURROGATE_PAIR = String.fromCodePoint(0x1f600)

interface SafeLink {
  label: string
  repository: string
  externalId: string
  pathname: string
}

const REJECTED_REPOSITORIES: [string, string][] = [
  ['a parent segment first', '../evil'],
  ['a parent segment last', 'acme/..'],
  ['two parent segments', '../../evil/x'],
  ['a current segment last', 'acme/.'],
  ['only current segments', './.'],
  ['a lone parent segment', '..'],
  ['a lone current segment', '.'],
  ['a parent segment behind whitespace', ' ../evil'],
  ['a parent segment after two segments', 'acme/shop/..'],
  ['an empty segment in the middle', 'acme//shop'],
  ['a leading slash', '/acme/shop'],
  ['a trailing slash', 'acme/shop/'],
  ['an empty owner', '/shop'],
  ['an empty name', 'acme/'],
  ['only a slash', '/'],
  ['a single segment', 'shop'],
  ['three segments', 'a/b/c'],
]

const ARABIC_INDIC_THREE = String.fromCodePoint(0x663)

const REJECTED_EXTERNAL_IDS: [string, string][] = [
  ['a parent segment', '..'],
  ['a current segment', '.'],
  ['a parent segment behind whitespace', ' .. '],
  ['a current segment behind whitespace', ' . '],
  ['three dots', '...'],
  ['an id that tries to open a segment and a query', '900/../x?y=1'],
  ['a percent-encoded parent segment', '%2e%2e'],
  ['a backslash', 'a\b'],
  ['a word sent by a custom client', 'run-7'],
  ['a reporter externalId instead of a run id', 'gha-900-test-report-1a2b3c4d'],
  ['a number with a letter', '900a'],
  ['a negative number', '-900'],
  ['a decimal number', '9.5'],
  ['an exponent', '1e3'],
  ['digits outside ASCII', ARABIC_INDIC_THREE],
  ['more than twenty digits', '1'.repeat(21)],
]

const SAFE_LINKS: SafeLink[] = [
  {
    label: 'a plain repository and id',
    repository: 'acme/shop',
    externalId: '900',
    pathname: '/acme/shop/actions/runs/900',
  },
  {
    label: 'a repository whose name starts with a dot',
    repository: 'acme/.github',
    externalId: '900',
    pathname: '/acme/.github/actions/runs/900',
  },
  {
    label: 'a repository name made of three dots',
    repository: 'acme/...',
    externalId: '900',
    pathname: '/acme/.../actions/runs/900',
  },
  {
    label: 'a percent-encoded parent segment, which is encoded and never decoded',
    repository: '%2e%2e/evil',
    externalId: '900',
    pathname: '/%252e%252e/evil/actions/runs/900',
  },
  {
    label: 'a percent-encoded current segment in the name',
    repository: 'acme/%2e',
    externalId: '900',
    pathname: '/acme/%252e/actions/runs/900',
  },
  {
    label: 'a backslash in the repository',
    repository: 'acme/shop\\..',
    externalId: '900',
    pathname: '/acme/shop%5C../actions/runs/900',
  },
  {
    label: 'spaces in the repository',
    repository: 'my org/my shop',
    externalId: '900',
    pathname: '/my%20org/my%20shop/actions/runs/900',
  },
  {
    label: 'a query and a fragment in the repository',
    repository: 'acme/shop?x=1#y',
    externalId: '900',
    pathname: '/acme/shop%3Fx%3D1%23y/actions/runs/900',
  },
  {
    label: 'a surrogate pair in the repository',
    repository: `acme/shop${SURROGATE_PAIR}`,
    externalId: '900',
    pathname: '/acme/shop%F0%9F%98%80/actions/runs/900',
  },
]

function linkOf(overrides: Partial<CiRunSummaryRecord>): URL {
  const href = buildCiRunUrl(ciRun(overrides))

  if (href === undefined) throw new Error('expected a link and got undefined')

  return new URL(href)
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

  })

  describe('links only a run id made of digits', () => {
    it.each(['1', '900', '12345678901', '1'.repeat(20)])('links the id %s', (externalId) => {
      expect(buildCiRunUrl(ciRun({ externalId }))).toBe(
        `https://github.com/acme/shop/actions/runs/${externalId}`,
      )
    })

    it('links an id with leading zeros as it is stored', () => {
      expect(buildCiRunUrl(ciRun({ externalId: '0900' }))).toBe(
        'https://github.com/acme/shop/actions/runs/0900',
      )
    })
  })

  describe('refuses a path that would leave the run page of the repository', () => {
    it.each(REJECTED_REPOSITORIES)('returns undefined for a repository with %s', (_label, repository) => {
      expect(buildCiRunUrl(ciRun({ repository }))).toBeUndefined()
    })

    it.each(REJECTED_EXTERNAL_IDS)('returns undefined for an external id that is %s', (_label, externalId) => {
      expect(buildCiRunUrl(ciRun({ externalId }))).toBeUndefined()
    })
  })

  describe('keeps every link it does build inside the run page of the repository', () => {
    it.each(SAFE_LINKS)('links $label', ({ repository, externalId, pathname }) => {
      const url = linkOf({ repository, externalId })

      expect(url.pathname).toBe(pathname)
      expect(url.origin).toBe(GITHUB_ORIGIN)
      expect(url.search).toBe('')
      expect(url.hash).toBe('')
      expect(url.username).toBe('')
    })

    it('keeps only the sanitized origin of the server in the link', () => {
      const url = linkOf({ serverUrl: 'https://user:pw@ghe.internal:8443/x?token=abc#frag' })

      expect(url.origin).toBe('https://ghe.internal:8443')
      expect(url.pathname).toBe('/acme/shop/actions/runs/900')
    })

    it('never yields a link outside the run page, whatever the repository and the id', () => {
      const repositories = [
        ...REJECTED_REPOSITORIES.map(([, repository]) => repository),
        ...SAFE_LINKS.map((link) => link.repository),
      ]
      const externalIds = [
        ...REJECTED_EXTERNAL_IDS.map(([, externalId]) => externalId),
        ...SAFE_LINKS.map((link) => link.externalId),
      ]
      const links = repositories.flatMap((repository) =>
        externalIds.map((externalId) => buildCiRunUrl(ciRun({ repository, externalId }))),
      )
      const built = links.filter((link): link is string => link !== undefined)

      expect(built.length).toBeGreaterThan(0)
      expect(built.length).toBeLessThan(links.length)

      for (const link of built) {
        const url = new URL(link)
        const segments = url.pathname.split('/')

        expect(url.origin).toBe(GITHUB_ORIGIN)
        expect(segments).toHaveLength(6)
        expect(segments.slice(3, 5)).toStrictEqual(['actions', 'runs'])
      }
    })
  })

  describe('never throws on a lone surrogate', () => {
    it.each<[string, Partial<CiRunSummaryRecord>]>([
      ['the repository name', { repository: `acme/shop${LONE_SURROGATE}` }],
      ['the repository owner', { repository: `${LONE_SURROGATE}/shop` }],
      ['the external id', { externalId: `900${LONE_SURROGATE}` }],
      ['the server URL', { serverUrl: `https://github.com${LONE_SURROGATE}` }],
    ])('returns undefined for a lone surrogate in %s', (_label, overrides) => {
      expect(() => buildCiRunUrl(ciRun(overrides))).not.toThrow()
      expect(buildCiRunUrl(ciRun(overrides))).toBeUndefined()
    })
  })
})
