import { DiscordChannel } from './discord.channel';

function mockFetch(response: Partial<Response>): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue(response as Response);
  (globalThis as { fetch: typeof fetch }).fetch = fetchMock as never;
  return fetchMock;
}

describe('DiscordChannel.send', () => {
  it('posts json with a content field and always sets wait=true', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    await new DiscordChannel().send(
      'https://discord.com/api/webhooks/1/token',
      'Run failed',
    );

    const [calledUrl, init] = fetchMock.mock.calls[0] as [
      string,
      { method: string; body: string },
    ];
    expect(calledUrl).toBe(
      'https://discord.com/api/webhooks/1/token?wait=true',
    );
    expect(JSON.parse(init.body)).toEqual({
      content: 'Run failed',
      allowed_mentions: { parse: [] },
    });
  });

  it('always sends allowed_mentions: { parse: [] } to block @everyone injection', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    await new DiscordChannel().send(
      'https://discord.com/api/webhooks/1/token',
      '@everyone the suite failed',
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as {
      content: string;
      allowed_mentions: { parse: string[] };
    };
    expect(body.content).toBe('@everyone the suite failed');
    expect(body.allowed_mentions).toEqual({ parse: [] });
  });

  it('truncates content to the 2000 character discord limit', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });
    const longContent = 'x'.repeat(2500);

    await new DiscordChannel().send(
      'https://discord.com/api/webhooks/1/token',
      longContent,
    );

    const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    const body = JSON.parse(init.body) as { content: string };
    expect(body.content).toHaveLength(2000);
  });

  it('throws when discord responds with a rate limit', async () => {
    mockFetch({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '1.5' }),
    });

    await expect(
      new DiscordChannel().send('https://discord.com/api/webhooks/1/x', 'hi'),
    ).rejects.toThrow(/rate limit/i);
  });

  it('throws on any other non-2xx response so BullMQ retries', async () => {
    mockFetch({ ok: false, status: 500, headers: new Headers() });

    await expect(
      new DiscordChannel().send('https://discord.com/api/webhooks/1/x', 'hi'),
    ).rejects.toThrow(/500/);
  });
});
