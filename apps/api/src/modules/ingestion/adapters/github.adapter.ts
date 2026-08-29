import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  NormalizedScmEvent,
  ScmHeaders,
  ScmPayloadAdapter,
} from '../ingestion.contracts';

const SIGNATURE_HEADER = 'x-hub-signature-256';
const EVENT_HEADER = 'x-github-event';
const DELIVERY_HEADER = 'x-github-delivery';
const BRANCH_PREFIX = 'refs/heads/';
const HANDLED_PR_ACTIONS = ['opened', 'synchronize'];

interface PushPayload {
  ref?: string;
  repository?: { full_name?: string };
  pusher?: { name?: string };
  head_commit?: { id?: string; message?: string; url?: string } | null;
}

interface PullRequestPayload {
  action?: string;
  pull_request?: {
    head?: { ref?: string; sha?: string };
    title?: string;
    html_url?: string;
    user?: { login?: string };
  };
  repository?: { full_name?: string };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

@Injectable()
export class GithubAdapter implements ScmPayloadAdapter {
  readonly provider = 'GITHUB' as const;

  verifySignature(
    rawBody: string,
    headers: ScmHeaders,
    secret: string,
  ): boolean {
    const received = headers[SIGNATURE_HEADER];

    if (received === undefined) return false;

    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;

    if (expected.length !== received.length) return false;

    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  }

  normalize(payload: unknown, headers: ScmHeaders): NormalizedScmEvent | null {
    const body = asRecord(payload);
    const eventId = headers[DELIVERY_HEADER];

    if (body === null || eventId === undefined) return null;

    switch (headers[EVENT_HEADER]) {
      case 'push':
        return this.fromPush(body, eventId);
      case 'pull_request':
        return this.fromPullRequest(body, eventId);
      default:
        return null;
    }
  }

  private fromPush(
    payload: PushPayload,
    eventId: string,
  ): NormalizedScmEvent | null {
    const commit = payload.head_commit;
    const repo = payload.repository?.full_name;

    if (!commit?.id || repo === undefined) return null;

    return {
      eventId,
      provider: this.provider,
      kind: 'push',
      repo,
      branch: (payload.ref ?? '').replace(BRANCH_PREFIX, ''),
      commitSha: commit.id,
      author: payload.pusher?.name ?? 'unknown',
      title: commit.message ?? '',
      url: commit.url ?? '',
    };
  }

  private fromPullRequest(
    payload: PullRequestPayload,
    eventId: string,
  ): NormalizedScmEvent | null {
    const action = payload.action ?? '';
    const pull = payload.pull_request;
    const repo = payload.repository?.full_name;

    if (!HANDLED_PR_ACTIONS.includes(action)) return null;
    if (pull?.head?.sha === undefined || repo === undefined) return null;

    return {
      eventId,
      provider: this.provider,
      kind: 'pull_request',
      repo,
      branch: pull.head.ref ?? '',
      commitSha: pull.head.sha,
      author: pull.user?.login ?? 'unknown',
      title: pull.title ?? '',
      url: pull.html_url ?? '',
    };
  }
}
