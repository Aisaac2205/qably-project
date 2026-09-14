import { locateAndPersistAutomationFilePath } from './locate-and-persist-automation-file-path';

function deps(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    locate: jest.fn().mockResolvedValue(null),
    decrypt: jest.fn((value: string) => `decrypted:${value}`),
    persist: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function input(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    testCaseId: 'case-1',
    automationKey: 'Cart > adds an item',
    automationClassName: null,
    caseName: 'adds an item',
    suiteName: 'Cart',
    connection: {
      provider: 'GITHUB' as const,
      repo: 'acme/shop',
      encryptedAccessToken: 'enc-token',
    },
    ref: 'HEAD',
    ...overrides,
  };
}

describe('locateAndPersistAutomationFilePath', () => {
  it('returns null without calling locate when there is no connection', async () => {
    const d = deps();

    const result = await locateAndPersistAutomationFilePath(
      d as never,
      input({ connection: null }),
    );

    expect(result).toBeNull();
    expect(d.locate).not.toHaveBeenCalled();
  });

  it('splits the repo, decrypts the token and locates against the owner/repo pair', async () => {
    const d = deps();

    await locateAndPersistAutomationFilePath(d as never, input());

    expect(d.decrypt).toHaveBeenCalledWith('enc-token');
    expect(d.locate).toHaveBeenCalledWith({
      provider: 'GITHUB',
      owner: 'acme',
      repo: 'shop',
      ref: 'HEAD',
      accessToken: 'decrypted:enc-token',
      automationKey: 'Cart > adds an item',
      automationClassName: null,
      caseName: 'adds an item',
      suiteName: 'Cart',
    });
  });

  it('omits the access token when the connection has none stored', async () => {
    const d = deps();

    await locateAndPersistAutomationFilePath(
      d as never,
      input({
        connection: {
          provider: 'GITHUB',
          repo: 'acme/shop',
          encryptedAccessToken: null,
        },
      }),
    );

    expect(d.decrypt).not.toHaveBeenCalled();
    const [call] = d.locate.mock.calls as [{ accessToken?: string }][];
    expect(call[0].accessToken).toBeUndefined();
  });

  it('persists and returns the located path when the locator finds one', async () => {
    const d = deps({ locate: jest.fn().mockResolvedValue('src/cart/cart.spec.ts') });

    const result = await locateAndPersistAutomationFilePath(d as never, input());

    expect(result).toBe('src/cart/cart.spec.ts');
    expect(d.persist).toHaveBeenCalledWith('case-1', 'src/cart/cart.spec.ts');
  });

  it('never persists when the locator finds nothing', async () => {
    const d = deps();

    const result = await locateAndPersistAutomationFilePath(d as never, input());

    expect(result).toBeNull();
    expect(d.persist).not.toHaveBeenCalled();
  });
});
