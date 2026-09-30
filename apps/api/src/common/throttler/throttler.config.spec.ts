import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';
import { generateApiKeyToken } from '../../modules/api-keys/lib/token';
import {
  ADDRESS_THROTTLER_NAME,
  DEFAULT_THROTTLER_NAME,
  throttlerOptions,
} from './throttler.config';

function findThrottler(name: string): ThrottlerOptions {
  const found = throttlerOptions.throttlers.find(
    (throttler) => throttler.name === name,
  );

  if (found === undefined) throw new Error(`throttler ${name} is missing`);

  return found;
}

function contextFor(handlerName: string): ExecutionContext {
  class Controller {}
  const handler = { [handlerName]: () => undefined }[handlerName];

  return {
    getClass: () => Controller,
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

describe('throttlerOptions', () => {
  it('declares the default and the per address throttlers', () => {
    const names = throttlerOptions.throttlers.map(
      (throttler) => throttler.name,
    );

    expect(names).toEqual(
      expect.arrayContaining([DEFAULT_THROTTLER_NAME, ADDRESS_THROTTLER_NAME]),
    );
  });

  it('gives the per address ceiling more room than a single route bucket', () => {
    const address = findThrottler(ADDRESS_THROTTLER_NAME);
    const route = findThrottler(DEFAULT_THROTTLER_NAME);

    expect(address.limit).toBeGreaterThan(route.limit as number);
    expect(address.ttl).toBe(route.ttl);
  });

  describe('the per address throttler', () => {
    const address = findThrottler(ADDRESS_THROTTLER_NAME);

    it('tracks the address even when a well formed credential is presented', async () => {
      const tracker = await address.getTracker?.(
        {
          headers: {
            authorization: `Bearer ${generateApiKeyToken().token}`,
          },
          ip: '10.0.0.1',
        },
        contextFor('anything'),
      );

      expect(tracker).toBe('ip:10.0.0.1');
    });

    it('tolerates a request with no address', async () => {
      const tracker = await address.getTracker?.({}, contextFor('anything'));

      expect(tracker).toBe('ip:unknown');
    });

    it('shares one key across every route for the same address', () => {
      const first = address.generateKey?.(
        contextFor('listRuns'),
        'ip:10.0.0.1',
        ADDRESS_THROTTLER_NAME,
      );
      const second = address.generateKey?.(
        contextFor('createProject'),
        'ip:10.0.0.1',
        ADDRESS_THROTTLER_NAME,
      );

      expect(first).toBeDefined();
      expect(first).toBe(second);
    });

    it('gives another address another key', () => {
      const first = address.generateKey?.(
        contextFor('listRuns'),
        'ip:10.0.0.1',
        ADDRESS_THROTTLER_NAME,
      );
      const second = address.generateKey?.(
        contextFor('listRuns'),
        'ip:10.0.0.2',
        ADDRESS_THROTTLER_NAME,
      );

      expect(first).not.toBe(second);
    });

    it('keeps the raw address out of the storage key', () => {
      const key = address.generateKey?.(
        contextFor('listRuns'),
        'ip:10.0.0.1',
        ADDRESS_THROTTLER_NAME,
      );

      expect(key).not.toContain('10.0.0.1');
    });
  });

  it('leaves the default throttler on the class level tracker', () => {
    expect(findThrottler(DEFAULT_THROTTLER_NAME).getTracker).toBeUndefined();
  });
});
