import type { AvailableRepo } from '@qably/types';

const DEFAULT_BRANCH = 'main';

interface GithubRepoPayload {
  id?: string | number;
  full_name?: unknown;
  private?: unknown;
  default_branch?: unknown;
  pushed_at?: unknown;
  updated_at?: unknown;
}

function readTimestamp(payload: GithubRepoPayload): string {
  const pushed = payload.pushed_at;

  if (typeof pushed === 'string' && pushed !== '') return pushed;

  const updated = payload.updated_at;

  return typeof updated === 'string' ? updated : '';
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
    updatedAt: readTimestamp(payload),
  };
}

export function byMostRecentActivity(
  a: AvailableRepo,
  b: AvailableRepo,
): number {
  if (a.updatedAt === b.updatedAt) return a.fullName.localeCompare(b.fullName);
  if (a.updatedAt === '') return 1;
  if (b.updatedAt === '') return -1;

  return b.updatedAt.localeCompare(a.updatedAt);
}

export function toAvailableRepos(payload: unknown): AvailableRepo[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((entry) => toAvailableRepo(entry as GithubRepoPayload))
    .filter((repo): repo is AvailableRepo => repo !== null)
    .sort(byMostRecentActivity);
}
