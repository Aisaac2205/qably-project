import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { ReviewController } from '../../modules/review/review.controller';
import { CredentialThrottlerGuard } from './credential-throttler.guard';
import {
  ADDRESS_LIMIT,
  DEFAULT_LIMIT,
  REVIEW_ADDRESS_LIMIT,
  REVIEW_ROUTE_LIMIT,
  throttlerOptions,
} from './throttler.config';

class OtherController {
  list(): void {}
}

type Handler = object;

function handlerOf(classRef: { prototype: unknown }, name: string): Handler {
  return (classRef.prototype as Record<string, Handler>)[name];
}

function contextFor(classRef: object, handler: Handler, ip: string) {
  const request = { headers: {}, ip };
  const response = { header: jest.fn() };

  return {
    getClass: () => classRef,
    getHandler: () => handler,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

const approve = handlerOf(ReviewController, 'approve');
const reject = handlerOf(ReviewController, 'reject');
const findOne = handlerOf(ReviewController, 'findOne');
const list = handlerOf(OtherController, 'list');
const ADDRESS = '10.0.0.1';

describe('review routes under the throttler', () => {
  let storage: ThrottlerStorageService;
  let guard: CredentialThrottlerGuard;

  beforeEach(async () => {
    storage = new ThrottlerStorageService();
    guard = new CredentialThrottlerGuard(
      throttlerOptions,
      storage,
      new Reflector(),
    );
    await guard.onModuleInit();
  });

  afterEach(() => {
    storage.onApplicationShutdown();
  });

  async function hit(classRef: object, handler: Handler, times: number) {
    for (let index = 0; index < times; index += 1) {
      await guard.canActivate(contextFor(classRef, handler, ADDRESS));
    }
  }

  it('gives a decision route more room than an ordinary route', () => {
    expect(REVIEW_ROUTE_LIMIT).toBeGreaterThan(DEFAULT_LIMIT);
    expect(REVIEW_ADDRESS_LIMIT).toBeGreaterThanOrEqual(2 * REVIEW_ROUTE_LIMIT);
  });

  it('lets one address approve past the default route limit in one window', async () => {
    await expect(
      hit(ReviewController, approve, REVIEW_ROUTE_LIMIT),
    ).resolves.toBeUndefined();
  });

  it('keeps a burst of decisions out of the address ceiling the rest of the app shares', async () => {
    const half = Math.ceil((ADDRESS_LIMIT + 1) / 2);

    await hit(ReviewController, approve, half);
    await hit(ReviewController, reject, half);

    await expect(
      guard.canActivate(contextFor(OtherController, list, ADDRESS)),
    ).resolves.toBe(true);
  });

  it('still caps the decisions one address can make in one window', async () => {
    await hit(ReviewController, approve, REVIEW_ROUTE_LIMIT);
    await hit(ReviewController, reject, REVIEW_ROUTE_LIMIT);

    await expect(
      guard.canActivate(contextFor(ReviewController, findOne, ADDRESS)),
    ).rejects.toBeInstanceOf(ThrottlerException);
  });
});
