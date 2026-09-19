import { Injectable } from '@nestjs/common';
import type { WebhookChannel, WebhookNotification } from './channel.contracts';

const TITLE_LIMIT = 256;
const DESCRIPTION_LIMIT = 4096;

function describeRetryAfter(header: string | null): string {
  if (header === null) return 'unknown delay';

  const seconds = Number(header);

  return Number.isFinite(seconds) ? `${seconds}s` : header;
}

function toDecimalColor(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

@Injectable()
export class DiscordChannel implements WebhookChannel {
  async send(url: string, notification: WebhookNotification): Promise<void> {
    const target = new URL(url);
    target.searchParams.set('wait', 'true');

    const embed = {
      title: notification.title.slice(0, TITLE_LIMIT),
      description: notification.message.slice(0, DESCRIPTION_LIMIT),
      color: toDecimalColor(notification.color),
      timestamp: notification.timestamp,
      footer: { text: 'Qably' },
      ...(notification.url === undefined ? {} : { url: notification.url }),
    };

    const response = await fetch(target.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        embeds: [embed],
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
