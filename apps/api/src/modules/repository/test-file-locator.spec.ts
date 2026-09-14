import { TestFileLocator } from './test-file-locator';
import type { SourceReader } from './source-reader';

function fakeTree(paths: { path: string; type?: string }[]) {
  return { tree: paths };
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function fakeSourceReader(content: string | null): SourceReader {
  return {
    read: jest
      .fn()
      .mockResolvedValue(
        content === null
          ? { kind: 'unavailable', reason: 'http-404' }
          : { kind: 'content', content, truncated: false },
      ),
  } as unknown as SourceReader;
}

describe('TestFileLocator', () => {
  it('returns null for a non-GitHub provider', async () => {
    const fetchImpl = jest.fn();
    const locator = new TestFileLocator(fakeSourceReader(null), fetchImpl);

    const result = await locator.locate({
      provider: 'BITBUCKET',
      owner: 'acme',
      repo: 'shop',
      ref: 'main',
      automationKey: 'Cart > adds an item',
      caseName: 'adds an item',
    });

    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('finds the test file whose content contains the case title literal', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        fakeTree([
          { path: 'src/cart/cart.spec.ts', type: 'blob' },
          { path: 'src/cart/cart.ts', type: 'blob' },
          { path: 'src/payment/payment.spec.ts', type: 'blob' },
        ]),
      ),
    );
    const sourceReader = fakeSourceReader(
      "describe('Cart', () => { it('adds an item', () => {}) })",
    );
    const locator = new TestFileLocator(sourceReader, fetchImpl);

    const result = await locator.locate({
      provider: 'GITHUB',
      owner: 'acme',
      repo: 'shop',
      ref: 'main',
      accessToken: 'token-1',
      automationKey: 'Cart > adds an item',
      caseName: 'adds an item',
    });

    expect(result).toBe('src/cart/cart.spec.ts');
  });

  it('never returns a non-test file even if its content matches', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(fakeTree([{ path: 'src/cart/cart.ts', type: 'blob' }])),
      );
    const sourceReader = fakeSourceReader('adds an item');
    const locator = new TestFileLocator(sourceReader, fetchImpl);

    const result = await locator.locate({
      provider: 'GITHUB',
      owner: 'acme',
      repo: 'shop',
      ref: 'main',
      automationKey: 'Cart > adds an item',
      caseName: 'adds an item',
    });

    expect(result).toBeNull();
  });

  it('returns null when no candidate file contains the case title', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          fakeTree([{ path: 'src/cart/cart.spec.ts', type: 'blob' }]),
        ),
      );
    const sourceReader = fakeSourceReader('describe unrelated content here');
    const locator = new TestFileLocator(sourceReader, fetchImpl);

    const result = await locator.locate({
      provider: 'GITHUB',
      owner: 'acme',
      repo: 'shop',
      ref: 'main',
      automationKey: 'Cart > adds an item',
      caseName: 'adds an item',
    });

    expect(result).toBeNull();
  });

  it('never guesses when the tree has no test files that score any overlap', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          fakeTree([{ path: 'src/unrelated/payment.spec.ts', type: 'blob' }]),
        ),
      );
    const read = jest.fn().mockResolvedValue({
      kind: 'content',
      content: 'does not matter',
      truncated: false,
    });
    const sourceReader = { read } as unknown as SourceReader;
    const locator = new TestFileLocator(sourceReader, fetchImpl);

    const result = await locator.locate({
      provider: 'GITHUB',
      owner: 'acme',
      repo: 'shop',
      ref: 'main',
      automationKey: 'Cart > adds an item',
      caseName: 'adds an item',
    });

    expect(result).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });

  it('caches the tree per owner/repo@ref so a second lookup does not refetch', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(
          fakeTree([{ path: 'src/cart/cart.spec.ts', type: 'blob' }]),
        ),
      );
    const sourceReader = fakeSourceReader('adds an item');
    const locator = new TestFileLocator(sourceReader, fetchImpl);

    await locator.locate({
      provider: 'GITHUB',
      owner: 'acme',
      repo: 'shop',
      ref: 'main',
      automationKey: 'Cart > adds an item',
      caseName: 'adds an item',
    });
    await locator.locate({
      provider: 'GITHUB',
      owner: 'acme',
      repo: 'shop',
      ref: 'main',
      automationKey: 'Cart > adds another item',
      caseName: 'adds another item',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('sends the access token as a bearer header when fetching the tree', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(fakeTree([])));
    const locator = new TestFileLocator(fakeSourceReader(null), fetchImpl);

    await locator.locate({
      provider: 'GITHUB',
      owner: 'acme',
      repo: 'shop',
      ref: 'main',
      accessToken: 'token-1',
      automationKey: 'Cart > adds an item',
      caseName: 'adds an item',
    });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer token-1',
    );
  });
});
