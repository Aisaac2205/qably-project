import { DiscordChannel } from './discord.channel';
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

describe('DiscordChannel.send', () => {
  it('posts an embed and always sets wait=true', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    await new DiscordChannel().send(
      'https://discord.com/api/webhooks/1/token',
      notification(),
    );

    const [calledUrl, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(calledUrl).toBe(
      'https://discord.com/api/webhooks/1/token?wait=true',
    );
    const body = JSON.parse(init.body) as {
      embeds: Array<{
        title: string;
        description: string;
        color: number;
        timestamp: string;
        footer: { text: string };
        url?: string;
      }>;
      allowed_mentions: { parse: string[] };
    };
    expect(body.embeds).toHaveLength(1);
    expect(body.embeds[0]).toEqual({
      title: 'Run failed',
      description: 'The run "Checkout regression" in Checkout failed.',
      color: 0xe74c3c,
      timestamp: '2026-01-01T00:00:00.000Z',
      footer: { text: 'Qably' },
    });
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it('includes the embed url when a deep link is provided', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    await new DiscordChannel().send(
      'https://discord.com/api/webhooks/1/token',
      notification({ url: 'https://app.qably.dev/projects/p1/runs/r1' }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as {
      embeds: Array<{ url?: string }>;
    };
    expect(body.embeds[0].url).toBe(
      'https://app.qably.dev/projects/p1/runs/r1',
    );
  });

  it('always sends allowed_mentions: { parse: [] } to block @everyone injection', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    await new DiscordChannel().send(
      'https://discord.com/api/webhooks/1/token',
      notification({ message: '@everyone the suite failed' }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as {
      embeds: Array<{ description: string }>;
      allowed_mentions: { parse: string[] };
    };
    expect(body.embeds[0].description).toBe('@everyone the suite failed');
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it('truncates the description to the 4096 character discord embed limit', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });
    const longMessage = 'x'.repeat(4500);

    await new DiscordChannel().send(
      'https://discord.com/api/webhooks/1/token',
      notification({ message: longMessage }),
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as {
      embeds: Array<{ description: string }>;
    };
    expect(body.embeds[0].description).toHaveLength(4096);
  });

  it('throws when discord responds with a rate limit', async () => {
    mockFetch({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '1.5' }),
    });

    await expect(
      new DiscordChannel().send(
        'https://discord.com/api/webhooks/1/x',
        notification(),
      ),
    ).rejects.toThrow(/rate limit/i);
  });

  it('throws on any other non-2xx response so BullMQ retries', async () => {
    mockFetch({ ok: false, status: 500, headers: new Headers() });

    await expect(
      new DiscordChannel().send(
        'https://discord.com/api/webhooks/1/x',
        notification(),
      ),
    ).rejects.toThrow(/500/);
  });
});
