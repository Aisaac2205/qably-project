import { Injectable, Optional } from '@nestjs/common';
import type { RepoConnectionProvider } from '@qably/types';

const TIMEOUT_MS = 15_000;
const MAX_CONTENT_LENGTH = 60_000;

export interface SourceReadInput {
  provider: RepoConnectionProvider;
  owner: string;
  repo: string;
  ref: string;
  path: string;
  accessToken?: string;
}

export type SourceReadResult =
  | { kind: 'content'; content: string; truncated: boolean }
  | { kind: 'unavailable'; reason: string };

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const BLOB_PATH: Record<
  RepoConnectionProvider,
  (repo: string, sha: string, filePath: string) => string
> = {
  GITHUB: (repo, sha, filePath) =>
    `https://github.com/${repo}/blob/${sha}/${filePath}`,
  BITBUCKET: (repo, sha, filePath) =>
    `https://bitbucket.org/${repo}/src/${sha}/${filePath}`,
};

export function buildBlobUrl(
  provider: RepoConnectionProvider,
  repo: string,
  sha: string,
  filePath: string,
): string {
  return BLOB_PATH[provider](repo, sha, filePath);
}

function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function githubUrl(input: SourceReadInput): string {
  const owner = encodeURIComponent(input.owner);
  const repo = encodeURIComponent(input.repo);
  const ref = encodeURIComponent(input.ref);
  const path = encodePath(input.path);

  if (input.accessToken === undefined) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
  }

  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${ref}`;
}

function githubHeaders(input: SourceReadInput): Record<string, string> {
  if (input.accessToken === undefined) return {};

  return {
    Authorization: `Bearer ${input.accessToken}`,
    Accept: 'application/vnd.github.raw+json',
  };
}

function bitbucketUrl(input: SourceReadInput): string {
  const owner = encodeURIComponent(input.owner);
  const repo = encodeURIComponent(input.repo);
  const ref = encodeURIComponent(input.ref);
  const path = encodePath(input.path);
  return `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}/src/${ref}/${path}`;
}

function bitbucketHeaders(input: SourceReadInput): Record<string, string> {
  if (input.accessToken === undefined) return {};

  return { Authorization: `Bearer ${input.accessToken}` };
}

const BUILD_REQUEST: Record<
  RepoConnectionProvider,
  (input: SourceReadInput) => { url: string; headers: Record<string, string> }
> = {
  GITHUB: (input) => ({ url: githubUrl(input), headers: githubHeaders(input) }),
  BITBUCKET: (input) => ({
    url: bitbucketUrl(input),
    headers: bitbucketHeaders(input),
  }),
};

@Injectable()
export class SourceReader {
  constructor(
    @Optional()
    private readonly fetchImpl: FetchLike = (url, init) =>
      globalThis.fetch(url, init),
  ) {}

  async read(input: SourceReadInput): Promise<SourceReadResult> {
    const { url, headers } = BUILD_REQUEST[input.provider](input);

    try {
      const response = await this.fetchImpl(url, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        return { kind: 'unavailable', reason: `http-${response.status}` };
      }

      const body = await response.text();
      const truncated = body.length > MAX_CONTENT_LENGTH;

      return {
        kind: 'content',
        content: truncated ? body.slice(0, MAX_CONTENT_LENGTH) : body,
        truncated,
      };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'TimeoutError'
          ? 'timeout'
          : 'fetch-failed';
      return { kind: 'unavailable', reason };
    }
  }
}
