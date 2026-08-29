import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AvailableRepo } from '@qably/types';
import { AUTH_INSTANCE, type AuthInstance } from '../../auth/auth.instance';
import type { RepoDirectory } from '../connections.contracts';
import { toAvailableRepos } from '../lib/github-repos';

const REPOS_URL =
  'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,organization_member';

const PROVIDER_ID = 'github';

@Injectable()
export class GithubRepoDirectory implements RepoDirectory {
  private readonly logger = new Logger(GithubRepoDirectory.name);

  constructor(@Inject(AUTH_INSTANCE) private readonly auth: AuthInstance) {}

  async readPackageManifest(userId: string, repo: string): Promise<unknown> {
    const accessToken = await this.readAccessToken(userId);

    if (accessToken === null) return null;

    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/package.json`,
      { headers: this.headers(accessToken) },
    );

    if (!response.ok) return null;

    const payload = (await response.json()) as { content?: unknown };

    if (typeof payload.content !== 'string') return null;

    try {
      return JSON.parse(
        Buffer.from(payload.content, 'base64').toString('utf8'),
      ) as unknown;
    } catch {
      this.logger.warn(`Unreadable package.json in ${repo}`);
      return null;
    }
  }

  async listForUser(userId: string): Promise<AvailableRepo[]> {
    const accessToken = await this.readAccessToken(userId);

    if (accessToken === null) return [];

    const response = await fetch(REPOS_URL, {
      headers: this.headers(accessToken),
    });

    if (!response.ok) {
      this.logger.warn(`GitHub rejected the repository listing for ${userId}`);
      return [];
    }

    return toAvailableRepos(await response.json());
  }

  private headers(accessToken: string): Record<string, string> {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
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
