import { createHash } from 'node:crypto';
import type { ThrottlerOptions } from '@nestjs/throttler';
import { addressTracker } from './address-tracker';

export const DEFAULT_THROTTLER_NAME = 'default';
export const ADDRESS_THROTTLER_NAME = 'ip';

export const THROTTLE_WINDOW_MS = 60_000;
export const DEFAULT_LIMIT = 120;
export const ADDRESS_LIMIT = 600;

function addressCeilingKey(
  _context: unknown,
  tracker: string,
  throttlerName: string,
): string {
  return createHash('sha256')
    .update(`${throttlerName}-${tracker}`)
    .digest('hex');
}

export const throttlerOptions: { throttlers: ThrottlerOptions[] } = {
  throttlers: [
    {
      name: DEFAULT_THROTTLER_NAME,
      ttl: THROTTLE_WINDOW_MS,
      limit: DEFAULT_LIMIT,
    },
    {
      name: ADDRESS_THROTTLER_NAME,
      ttl: THROTTLE_WINDOW_MS,
      limit: ADDRESS_LIMIT,
      getTracker: addressTracker,
      generateKey: addressCeilingKey,
    },
  ],
};
