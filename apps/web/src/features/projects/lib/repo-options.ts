import type { AvailableRepo, RepoConnection } from '@qably/types'

export const REPO_OPTION_PREFIX = 'repo:'

export interface RepoOption {
  value: string
  repo: string
  isPrivate: boolean
}

export function buildRepoOptions(
  connections: RepoConnection[],
  repos: AvailableRepo[],
): RepoOption[] {
  const byRepo = new Map(
    connections.map((connection) => [connection.repo, connection]),
  )
  const listed = new Set(repos.map((repo) => repo.fullName))

  const fromGithub = repos.map((repo) => ({
    value:
      byRepo.get(repo.fullName)?.id ?? `${REPO_OPTION_PREFIX}${repo.fullName}`,
    repo: repo.fullName,
    isPrivate: repo.isPrivate,
  }))

  const orphaned = connections
    .filter((connection) => !listed.has(connection.repo))
    .map((connection) => ({
      value: connection.id,
      repo: connection.repo,
      isPrivate: false,
    }))

  return [...fromGithub, ...orphaned]
}
