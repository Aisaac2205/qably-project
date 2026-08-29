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
  const connected = new Set(connections.map((connection) => connection.repo))

  return [
    ...connections.map((connection) => ({
      value: connection.id,
      repo: connection.repo,
      isPrivate: repos.find((repo) => repo.fullName === connection.repo)
        ?.isPrivate ?? false,
    })),
    ...repos
      .filter((repo) => !connected.has(repo.fullName))
      .map((repo) => ({
        value: `${REPO_OPTION_PREFIX}${repo.fullName}`,
        repo: repo.fullName,
        isPrivate: repo.isPrivate,
      })),
  ]
}
