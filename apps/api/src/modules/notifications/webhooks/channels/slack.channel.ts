import { Injectable } from '@nestjs/common';
import type { WebhookChannel, WebhookNotification } from './channel.contracts';

const HEADER_LIMIT = 150;
const SECTION_TEXT_LIMIT = 3000;

function describeRetryAfter(header: string | null): string {
  if (header === null) return 'unknown delay';

  const seconds = Number(header);

  return Number.isFinite(seconds) ? `${seconds}s` : header;
}

function contextText(notification: WebhookNotification): string {
  const epochSeconds = Math.floor(
    new Date(notification.timestamp).getTime() / 1000,
  );
  const dateToken = `<!date^${epochSeconds}^{date_short_pretty} at {time}|${notification.timestamp}>`;

  return notification.url === undefined
    ? dateToken
    : `${dateToken} • <${notification.url}|View in Qably>`;
}

@Injectable()
export class SlackChannel implements WebhookChannel {
  async send(url: string, notification: WebhookNotification): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: notification.message,
        attachments: [
          {
            color: notification.color,
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: notification.title.slice(0, HEADER_LIMIT),
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: notification.message.slice(0, SECTION_TEXT_LIMIT),
                },
              },
              {
                type: 'context',
                elements: [{ type: 'mrkdwn', text: contextText(notification) }],
              },
            ],
          },
        ],
      }),
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
