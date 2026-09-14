import { Injectable, Optional } from '@nestjs/common';
import type { RepoConnectionProvider } from '@qably/types';
import { isTestFilePath } from './lib/test-file-pattern';
import { jaccardScore, tokenize } from './lib/tokenize';
import { SourceReader } from './source-reader';

const TREE_CACHE_TTL_MS = 10 * 60 * 1000;
const TOP_CANDIDATES = 5;
const API = 'https://api.github.com';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface LocateInput {
  provider: RepoConnectionProvider;
  owner: string;
  repo: string;
  ref: string;
  accessToken?: string;
  automationKey: string | null;
  automationClassName?: string | null;
  caseName: string;
  suiteName?: string | null;
}

interface CachedTree {
  paths: string[];
  expiresAt: number;
}

function descriptorText(input: LocateInput): string {
  return [
    input.automationClassName,
    input.caseName,
    input.suiteName,
    input.automationKey,
  ]
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .join(' ');
}

function titleLiteralsFrom(input: LocateInput): string[] {
  const literals = new Set<string>();

  if (input.automationKey !== null && input.automationKey !== undefined) {
    const segments = input.automationKey.split(' > ');
    const last = segments[segments.length - 1]?.trim();
    if (last !== undefined && last.length > 0) literals.add(last);
  }

  const trimmedName = input.caseName.trim();
  if (trimmedName.length > 0) literals.add(trimmedName);

  return [...literals];
}

@Injectable()
export class TestFileLocator {
  private readonly cache = new Map<string, CachedTree>();

  constructor(
    private readonly sourceReader: SourceReader,
    @Optional()
    private readonly fetchImpl: FetchLike = (url, init) =>
      globalThis.fetch(url, init),
  ) {}

  async locate(input: LocateInput): Promise<string | null> {
    if (input.provider !== 'GITHUB') return null;

    const paths = await this.loadTestFilePaths(input);
    if (paths.length === 0) return null;

    const descriptorTokens = tokenize(descriptorText(input));

    const scored = paths
      .map((path) => ({
        path,
        score: jaccardScore(tokenize(path), descriptorTokens),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_CANDIDATES);

    if (scored.length === 0) return null;

    const titleLiterals = titleLiteralsFrom(input);

    for (const candidate of scored) {
      const source = await this.sourceReader.read({
        provider: input.provider,
        owner: input.owner,
        repo: input.repo,
        ref: input.ref,
        path: candidate.path,
        accessToken: input.accessToken,
      });

      if (source.kind !== 'content') continue;
      if (titleLiterals.some((literal) => source.content.includes(literal))) {
        return candidate.path;
      }
    }

    return null;
  }

  private async loadTestFilePaths(input: LocateInput): Promise<string[]> {
    const cacheKey = `${input.owner}/${input.repo}@${input.ref}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();

    if (cached !== undefined && cached.expiresAt > now) return cached.paths;

    const paths = await this.fetchTestFilePaths(input);
    this.cache.set(cacheKey, { paths, expiresAt: now + TREE_CACHE_TTL_MS });

    return paths;
  }

  private async fetchTestFilePaths(input: LocateInput): Promise<string[]> {
    const owner = encodeURIComponent(input.owner);
    const repo = encodeURIComponent(input.repo);
    const ref = encodeURIComponent(input.ref);
    const url = `${API}/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`;

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (input.accessToken !== undefined) {
      headers.Authorization = `Bearer ${input.accessToken}`;
    }

    try {
      const response = await this.fetchImpl(url, { headers });
      if (!response.ok) return [];

      const payload = (await response.json()) as {
        tree?: { path?: string; type?: string }[];
      };

      return (payload.tree ?? [])
        .filter(
          (entry): entry is { path: string; type: string } =>
            entry.type === 'blob' && typeof entry.path === 'string',
        )
        .map((entry) => entry.path)
        .filter(isTestFilePath);
    } catch {
      return [];
    }
  }
}
