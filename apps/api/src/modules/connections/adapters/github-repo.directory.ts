import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AvailableRepo } from '@qably/types';
import { AUTH_INSTANCE, type AuthInstance } from '../../auth/auth.instance';
import type { RepoDirectory } from '../connections.contracts';
import type { RepoManifests } from '../lib/detect-stack';
import { byMostRecentActivity, toAvailableRepos } from '../lib/github-repos';
import { manifestKind, selectManifestPaths } from '../lib/manifest-paths';

const API = 'https://api.github.com';
const PROVIDER_ID = 'github';
const PER_PAGE = 100;
const MAX_PAGES = 5;

@Injectable()
export class GithubRepoDirectory implements RepoDirectory {
  private readonly logger = new Logger(GithubRepoDirectory.name);

  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance) {}

  async listForUser(userId: string): Promise<AvailableRepo[]> {
    const accessToken = await this.readAccessToken(userId);

    if (accessToken === null) return [];

    const collected: AvailableRepo[] = [];

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const payload = await this.get(
        `/user/repos?per_page=${PER_PAGE}&page=${page}&sort=updated&affiliation=owner,organization_member`,
        accessToken,
      );

      if (payload === null) break;

      const batch = toAvailableRepos(payload);

      collected.push(...batch);

      if (!Array.isArray(payload) || payload.length < PER_PAGE) break;
    }

    return collected.sort(byMostRecentActivity);
  }

  async readManifests(userId: string, repo: string): Promise<RepoManifests> {
    const accessToken = await this.readAccessToken(userId);

    if (accessToken === null) return {};

    const branch = await this.readDefaultBranch(repo, accessToken);

    if (branch === null) return {};

    const tree = await this.get(
      `/repos/${repo}/git/trees/${branch}?recursive=1`,
      accessToken,
    );

    const paths = selectManifestPaths(tree);
    const manifests: RepoManifests = {};

    await Promise.all(
      paths.map(async (path) => {
        const content = await this.readFile(accessToken, repo, path);

        if (content === null) return;

        const kind = manifestKind(path);

        manifests[kind] = [...(manifests[kind] ?? []), content];
      }),
    );

    return manifests;
  }

  private async readDefaultBranch(
    repo: string,
    accessToken: string,
  ): Promise<string | null> {
    const payload = await this.get(`/repos/${repo}`, accessToken);

    if (payload === null || Array.isArray(payload)) return null;

    const { default_branch: branch } = payload as { default_branch?: unknown };

    return typeof branch === 'string' && branch !== '' ? branch : null;
  }

  private async readFile(
    accessToken: string,
    repo: string,
    path: string,
  ): Promise<string | null> {
    const payload = await this.get(
      `/repos/${repo}/contents/${path}`,
      accessToken,
    );

    if (payload === null || Array.isArray(payload)) return null;

    const { content } = payload as { content?: unknown };

    if (typeof content !== 'string') return null;

    return Buffer.from(content, 'base64').toString('utf8');
  }

  private async get(path: string, accessToken: string): Promise<unknown> {
    const response = await fetch(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!response.ok) {
      this.logger.warn(`GitHub answered ${response.status} for ${path}`);
      return null;
    }

    return response.json();
  }

  private async readAccessToken(userId: string): Promise<string | null> {
    try {
      const result = await this.auth.api.getAccessToken({
        body: { providerId: PROVIDER_ID, userId },
      });

      return result.accessToken ?? null;
    } catch {
      this.logger.warn(`No github access token stored for ${userId}`);
      return null;
    }
  }
}
