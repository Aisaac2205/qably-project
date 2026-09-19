import { SlackChannel } from './slack.channel';
import type { WebhookNotification } from './channel.contracts';

function mockFetch(response: Partial<Response>): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue(response);
  (globalThis as { fetch: typeof fetch }).fetch = fetchMock as never;
  return fetchMock;
}

function notification(
  overrides: Partial<WebhookNotification> = {},
): WebhookNotification {
  return {
    title: 'Run failed',
    message: 'The run "Checkout regression" in Checkout failed.',
    color: '#E74C3C',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

interface SlackPayload {
  text: string;
  attachments: Array<{
    color: string;
    blocks: Array<{
      type: string;
      text?: { type: string; text: string };
      elements?: Array<{ type: string; text: string }>;
    }>;
  }>;
}

describe('SlackChannel.send', () => {
  it('posts a header/section/context block layout wrapped in a colored attachment', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    await new SlackChannel().send(
      'https://hooks.slack.com/services/T00/B00/token',
      notification(),
    );

    const [calledUrl, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; headers: Record<string, string>; body: string },
    ];
    expect(calledUrl).toBe('https://hooks.slack.com/services/T00/B00/token');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/json');

    const body = JSON.parse(init.body) as SlackPayload;
    expect(body.text).toBe('The run "Checkout regression" in Checkout failed.');
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].color).toBe('#E74C3C');
    const [header, section, context] = body.attachments[0].blocks;
    expect(header).toEqual({
      type: 'header',
      text: { type: 'plain_text', text: 'Run failed' },
    });
    expect(section).toEqual({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'The run "Checkout regression" in Checkout failed.',
      },
    });
    expect(context.type).toBe('context');
    expect(context.elements?.[0].text).toContain('date_short_pretty');
  });

  it('adds a "View in Qably" link to the context block when a deep link is provided', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    await new SlackChannel().send(
      'https://hooks.slack.com/services/T00/B00/token',
      notification({ url: 'https://app.qably.dev/projects/p1/runs/r1' }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as SlackPayload;
    const context = body.attachments[0].blocks[2];
    expect(context.elements?.[0].text).toContain(
      '<https://app.qably.dev/projects/p1/runs/r1|View in Qably>',
    );
  });

  it('throws when slack responds with a rate limit, without swallowing it', async () => {
    mockFetch({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '2' }),
    });

    await expect(
      new SlackChannel().send(
        'https://hooks.slack.com/services/x',
        notification(),
      ),
    ).rejects.toThrow(/rate limit/i);
  });

  it('throws on any other non-2xx response so BullMQ retries', async () => {
    mockFetch({ ok: false, status: 500, headers: new Headers() });

    await expect(
      new SlackChannel().send(
        'https://hooks.slack.com/services/x',
        notification(),
      ),
    ).rejects.toThrow(/500/);
  });
});
