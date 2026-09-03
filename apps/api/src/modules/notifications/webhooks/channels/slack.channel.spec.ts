import { SlackChannel } from './slack.channel';

function mockFetch(response: Partial<Response>): jest.Mock {
  const fetchMock = jest.fn().mockResolvedValue(response as Response);
  (globalThis as { fetch: typeof fetch }).fetch = fetchMock as never;
  return fetchMock;
}

describe('SlackChannel.send', () => {
  it('posts json with a text field to the webhook url', async () => {
    const fetchMock = mockFetch({
      ok: true,
      status: 200,
      headers: new Headers(),
    });

    await new SlackChannel().send(
      'https://hooks.slack.com/services/T00/B00/token',
      'Run failed',
    );

    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/T00/B00/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'content-type': 'application/json' }),
        body: JSON.stringify({ text: 'Run failed' }),
      }),
    );
  });

  it('throws when slack responds with a rate limit, without swallowing it', async () => {
    mockFetch({
      ok: false,
      status: 429,
      headers: new Headers({ 'retry-after': '2' }),
    });

    await expect(
      new SlackChannel().send('https://hooks.slack.com/services/x', 'hi'),
    ).rejects.toThrow(/rate limit/i);
  });

  it('throws on any other non-2xx response so BullMQ retries', async () => {
    mockFetch({ ok: false, status: 500, headers: new Headers() });

    await expect(
      new SlackChannel().send('https://hooks.slack.com/services/x', 'hi'),
    ).rejects.toThrow(/500/);
  });
});
