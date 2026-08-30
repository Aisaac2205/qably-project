import { describe, expect, it } from 'vitest'
import { REPO_OPTION_PREFIX, buildRepoOptions } from './repo-options'

function repo(fullName: string, updatedAt: string, isPrivate = false) {
  return {
    id: fullName,
    fullName,
    isPrivate,
    defaultBranch: 'main',
    updatedAt,
  }
}

function connection(id: string, repoName: string) {
  return {
    id,
    organizationId: 'org-1',
    provider: 'GITHUB' as const,
    name: repoName,
    repo: repoName,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('buildRepoOptions', () => {
  it('keeps the activity order github served instead of sorting by name', () => {
    const options = buildRepoOptions(
      [],
      [
        repo('acme/zulu', '2026-08-01T00:00:00Z'),
        repo('acme/alpha', '2026-01-01T00:00:00Z'),
      ],
    )

    expect(options.map((option) => option.repo)).toEqual([
      'acme/zulu',
      'acme/alpha',
    ])
  })

  it('keeps an already connected repository in its activity position', () => {
    const options = buildRepoOptions(
      [connection('conn-1', 'acme/alpha')],
      [
        repo('acme/zulu', '2026-08-01T00:00:00Z'),
        repo('acme/alpha', '2026-01-01T00:00:00Z'),
      ],
    )

    expect(options.map((option) => option.repo)).toEqual([
      'acme/zulu',
      'acme/alpha',
    ])
  })

  it('selects a connected repository by its connection id', () => {
    const options = buildRepoOptions(
      [connection('conn-1', 'acme/alpha')],
      [repo('acme/alpha', '2026-01-01T00:00:00Z')],
    )

    expect(options[0].value).toBe('conn-1')
  })

  it('selects an unconnected repository by its full name', () => {
    const options = buildRepoOptions([], [repo('acme/alpha', '2026-01-01Z')])

    expect(options[0].value).toBe(`${REPO_OPTION_PREFIX}acme/alpha`)
  })

  it('still offers a connection whose repository github no longer lists', () => {
    const options = buildRepoOptions(
      [connection('conn-9', 'acme/archived')],
      [repo('acme/alpha', '2026-01-01T00:00:00Z')],
    )

    expect(options.map((option) => option.repo)).toEqual([
      'acme/alpha',
      'acme/archived',
    ])
  })

  it('carries the privacy flag github reported', () => {
    const options = buildRepoOptions(
      [],
      [repo('acme/alpha', '2026-01-01T00:00:00Z', true)],
    )

    expect(options[0].isPrivate).toBe(true)
  })
})
