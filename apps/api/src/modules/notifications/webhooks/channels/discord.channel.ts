import { Injectable } from '@nestjs/common';
import type { WebhookChannel } from './channel.contracts';

const CONTENT_LIMIT = 2000;

function describeRetryAfter(header: string | null): string {
  if (header === null) return 'unknown delay';

  const seconds = Number(header);

  return Number.isFinite(seconds) ? `${seconds}s` : header;
}

@Injectable()
export class DiscordChannel implements WebhookChannel {
  async send(url: string, content: string): Promise<void> {
    const target = new URL(url);
    target.searchParams.set('wait', 'true');

    const response = await fetch(target.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        content: content.slice(0, CONTENT_LIMIT),
        allowed_mentions: { parse: [] },
      }),
    });

    if (response.status === 429) {
      throw new Error(
        `Discord rate limited the webhook; retry after ${describeRetryAfter(
          response.headers.get('retry-after'),
        )}`,
      );
    }

    if (!response.ok) {
      throw new Error(`Discord webhook failed with status ${response.status}`);
    }
  }
}
