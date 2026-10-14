import { createHash } from 'node:crypto';
import type { Throttle, ThrottlerOptions } from '@nestjs/throttler';
import { addressTracker } from './address-tracker';

export const DEFAULT_THROTTLER_NAME = 'default';
export const ADDRESS_THROTTLER_NAME = 'ip';

export const THROTTLE_WINDOW_MS = 60_000;
export const DEFAULT_LIMIT = 120;
export const ADDRESS_LIMIT = 600;

// A QA clears a large review inbox with one request per decision, often
// several per second. These limits let a person decide hundreds of proposals
// in a minute without a 429.
export const REVIEW_ROUTE_LIMIT = 600;
export const REVIEW_ADDRESS_LIMIT = 1_200;

function addressCeilingKey(
  _context: unknown,
  tracker: string,
  throttlerName: string,
): string {
  return createHash('sha256')
    .update(`${throttlerName}-${tracker}`)
    .digest('hex');
}

// The address ceiling shares one storage key across every route, and the
// in-memory storage blocks that whole key as soon as any route sees it above its
// own limit. Raising the ceiling on the review routes alone would therefore let
// a burst of decisions push the shared count past ADDRESS_LIMIT and lock the
// address out of every other route for a full window. The review routes count
// against a ceiling of their own instead.
function reviewCeilingKey(
  _context: unknown,
  tracker: string,
  throttlerName: string,
): string {
  return createHash('sha256')
    .update(`${throttlerName}-review-${tracker}`)
    .digest('hex');
}

export const reviewThrottle: Parameters<typeof Throttle>[0] = {
  [DEFAULT_THROTTLER_NAME]: {
    limit: REVIEW_ROUTE_LIMIT,
    ttl: THROTTLE_WINDOW_MS,
  },
  [ADDRESS_THROTTLER_NAME]: {
    limit: REVIEW_ADDRESS_LIMIT,
    ttl: THROTTLE_WINDOW_MS,
    generateKey: reviewCeilingKey,
  },
};

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
