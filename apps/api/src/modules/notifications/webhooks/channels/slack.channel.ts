import { Injectable } from '@nestjs/common';
import type { WebhookChannel } from './channel.contracts';

function describeRetryAfter(header: string | null): string {
  if (header === null) return 'unknown delay';

  const seconds = Number(header);

  return Number.isFinite(seconds) ? `${seconds}s` : header;
}

@Injectable()
export class SlackChannel implements WebhookChannel {
  async send(url: string, content: string): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: content }),
    });

    if (response.status === 429) {
      throw new Error(
        `Slack rate limited the webhook; retry after ${describeRetryAfter(
          response.headers.get('retry-after'),
        )}`,
      );
    }

    if (!response.ok) {
      throw new Error(`Slack webhook failed with status ${response.status}`);
    }
  }
}
