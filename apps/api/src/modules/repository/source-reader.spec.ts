import {
  buildBlobUrl,
  SourceReader,
  type SourceReadInput,
} from './source-reader';

function baseInput(overrides: Partial<SourceReadInput> = {}): SourceReadInput {
  return {
    provider: 'GITHUB',
    owner: 'qably',
    repo: 'qably',
    ref: 'abc123',
    path: 'src/cart.spec.ts',
    ...overrides,
  };
}

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {},
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    text: () =>
      Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

describe('SourceReader.read', () => {
  it('reads a public GitHub file from raw.githubusercontent.com when no token is given', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse('file contents'));
    const reader = new SourceReader(fetchImpl);

    const result = await reader.read(baseInput());

    expect(result).toEqual({
      kind: 'content',
      content: 'file contents',
      truncated: false,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://raw.githubusercontent.com/qably/qably/abc123/src/cart.spec.ts',
    );
    expect(
      (init.headers as Record<string, string> | undefined)?.Authorization,
    ).toBeUndefined();
  });

  it('reads a private GitHub file through the contents API when a token is given', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse('private contents'));
    const reader = new SourceReader(fetchImpl);

    const result = await reader.read(
      baseInput({ accessToken: 'secret-token' }),
    );

    expect(result).toEqual({
      kind: 'content',
      content: 'private contents',
      truncated: false,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.github.com/repos/qably/qably/contents/src/cart.spec.ts?ref=abc123',
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer secret-token');
    expect(headers.Accept).toBe('application/vnd.github.raw+json');
  });

  it('reads a public Bitbucket file with no Authorization header', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse('bb contents'));
    const reader = new SourceReader(fetchImpl);

    const result = await reader.read(
      baseInput({ provider: 'BITBUCKET', owner: 'my-workspace' }),
    );

    expect(result).toEqual({
      kind: 'content',
      content: 'bb contents',
      truncated: false,
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://api.bitbucket.org/2.0/repositories/my-workspace/qably/src/abc123/src/cart.spec.ts',
    );
    expect(
      (init.headers as Record<string, string> | undefined)?.Authorization,
    ).toBeUndefined();
  });

  it('sends a Bearer token for Bitbucket when given', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse('bb private'));
    const reader = new SourceReader(fetchImpl);

    await reader.read(
      baseInput({
        provider: 'BITBUCKET',
        owner: 'my-workspace',
        accessToken: 'bb-token',
      }),
    );

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer bb-token');
  });

  it('truncates content longer than 60000 characters and marks it truncated', async () => {
    const longContent = 'a'.repeat(70_000);
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(longContent));
    const reader = new SourceReader(fetchImpl);

    const result = await reader.read(baseInput());

    expect(result.kind).toBe('content');
    if (result.kind === 'content') {
      expect(result.content).toHaveLength(60_000);
      expect(result.truncated).toBe(true);
    }
  });

  it('returns unavailable when the response is not ok', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse('not found', { ok: false, status: 404 }));
    const reader = new SourceReader(fetchImpl);

    const result = await reader.read(baseInput());

    expect(result).toEqual({ kind: 'unavailable', reason: 'http-404' });
  });

  it('returns unavailable without leaking the token when fetch throws', async () => {
    const fetchImpl = jest
      .fn()
      .mockRejectedValue(new Error('secret-token leaked'));
    const reader = new SourceReader(fetchImpl);

    const result = await reader.read(
      baseInput({ accessToken: 'secret-token' }),
    );

    expect(result.kind).toBe('unavailable');
    if (result.kind === 'unavailable') {
      expect(result.reason).not.toContain('secret-token');
    }
  });

  it('url-encodes owner, repo and ref before building the request url', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse('ok'));
    const reader = new SourceReader(fetchImpl);

    await reader.read(
      baseInput({
        owner: 'my org',
        repo: 'repo#1',
        ref: 'feature/x y',
      }),
    );

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe(
      'https://raw.githubusercontent.com/my%20org/repo%231/feature%2Fx%20y/src/cart.spec.ts',
    );
  });

  it('url-encodes owner, repo and ref for the private GitHub contents API', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse('ok'));
    const reader = new SourceReader(fetchImpl);

    await reader.read(
      baseInput({
        owner: 'my org',
        repo: 'repo#1',
        ref: 'feature/x y',
        accessToken: 'secret-token',
      }),
    );

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe(
      'https://api.github.com/repos/my%20org/repo%231/contents/src/cart.spec.ts?ref=feature%2Fx%20y',
    );
  });

  it('url-encodes owner, repo and ref for Bitbucket', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse('ok'));
    const reader = new SourceReader(fetchImpl);

    await reader.read(
      baseInput({
        provider: 'BITBUCKET',
        owner: 'my workspace',
        repo: 'repo#1',
        ref: 'feature/x y',
      }),
    );

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe(
      'https://api.bitbucket.org/2.0/repositories/my%20workspace/repo%231/src/feature%2Fx%20y/src/cart.spec.ts',
    );
  });

  it('url-encodes each path segment while preserving slashes', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse('ok'));
    const reader = new SourceReader(fetchImpl);

    await reader.read(baseInput({ path: 'src/a b/c#.spec.ts' }));

    const [url] = fetchImpl.mock.calls[0] as [string];
    expect(url).toBe(
      'https://raw.githubusercontent.com/qably/qably/abc123/src/a%20b/c%23.spec.ts',
    );
  });
});

describe('buildBlobUrl', () => {
  it('builds a GitHub blob url', () => {
    expect(
      buildBlobUrl('GITHUB', 'qably/qably', 'abc123', 'src/cart.spec.ts'),
    ).toBe('https://github.com/qably/qably/blob/abc123/src/cart.spec.ts');
  });

  it('builds a Bitbucket blob url', () => {
    expect(
      buildBlobUrl('BITBUCKET', 'qably/qably', 'abc123', 'src/cart.spec.ts'),
    ).toBe('https://bitbucket.org/qably/qably/src/abc123/src/cart.spec.ts');
  });
});
