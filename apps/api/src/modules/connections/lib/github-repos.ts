import type { AvailableRepo } from '@qably/types';

const DEFAULT_BRANCH = 'main';

interface GithubRepoPayload {
  id?: string | number;
  full_name?: unknown;
  private?: unknown;
  default_branch?: unknown;
}

function toAvailableRepo(payload: GithubRepoPayload): AvailableRepo | null {
  const fullName = payload.full_name;

  if (typeof fullName !== 'string' || fullName.trim() === '') return null;

  return {
    id: payload.id === undefined ? fullName : String(payload.id),
    fullName,
    isPrivate: payload.private === true,
    defaultBranch:
      typeof payload.default_branch === 'string' &&
      payload.default_branch.trim() !== ''
        ? payload.default_branch
        : DEFAULT_BRANCH,
  };
}

export function toAvailableRepos(payload: unknown): AvailableRepo[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((entry) => toAvailableRepo(entry as GithubRepoPayload))
    .filter((repo): repo is AvailableRepo => repo !== null)
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}
