import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import {
  ADDRESS_THROTTLER_NAME,
  DEFAULT_THROTTLER_NAME,
  REVIEW_ADDRESS_LIMIT,
  REVIEW_ROUTE_LIMIT,
} from '../../common/throttler/throttler.config';
import { ReviewController } from './review.controller';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'qa@acme.test',
  name: 'QA',
  emailVerified: true,
  locale: null,
};

function fakeReview(result: unknown, lastDecision: unknown = null) {
  return {
    findOne: jest.fn().mockResolvedValue(result),
    approve: jest.fn().mockResolvedValue(result),
    reject: jest.fn().mockResolvedValue(result),
    lastDecision: jest.fn().mockResolvedValue(lastDecision),
  };
}

function build(review: ReturnType<typeof fakeReview>) {
  return new ReviewController(review as never, review as never);
}

describe('ReviewController error codes', () => {
  it('throws a coded NotFoundException when the proposal does not exist', async () => {
    const review = fakeReview({ ok: false, error: 'not-found' });

    await expect(
      build(review).findOne(org, 'proposal-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(review).findOne(org, 'proposal-1'),
    ).rejects.toMatchObject({ response: { code: 'not-found' } });
  });

  it('throws a coded ConflictException carrying who decided, what, and when', async () => {
    const decision = {
      action: 'approved' as const,
      decidedAt: '2026-01-05T12:00:00.000Z',
      decidedBy: { id: 'user-2', name: 'Grace Hopper' },
    };
    const review = fakeReview(
      { ok: false, error: 'invalid-transition' },
      decision,
    );

    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toMatchObject({
      response: { code: 'invalid-transition', decision },
    });
    expect(review.lastDecision).toHaveBeenCalledWith(org, 'proposal-1');
  });

  it('throws with a null decision when none was ever recorded for that proposal', async () => {
    const review = fakeReview({ ok: false, error: 'invalid-transition' }, null);

    await expect(
      build(review).reject(org, user, 'proposal-1', {}),
    ).rejects.toMatchObject({ response: { decision: null } });
  });

  it('throws a coded UnprocessableEntityException when evidence is missing', async () => {
    const review = fakeReview({ ok: false, error: 'missing-evidence' });

    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toMatchObject({ response: { code: 'missing-evidence' } });
  });

  it('throws a coded UnprocessableEntityException when the project has no suite', async () => {
    const review = fakeReview({ ok: false, error: 'missing-suite' });

    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toMatchObject({ response: { code: 'missing-suite' } });
  });

  it('throws a coded ConflictException when the title is already taken', async () => {
    const review = fakeReview({
      ok: false,
      error: { code: 'name-taken', conflictingCase: null },
    });

    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toMatchObject({
      response: { code: 'name-taken', conflictingCase: null },
    });
    expect(review.lastDecision).not.toHaveBeenCalled();
  });

  it('throws a coded ConflictException when the case moved past the version the reviewer saw', async () => {
    const review = fakeReview({ ok: false, error: 'stale-proposal' });

    await expect(
      build(review).approve(org, user, 'proposal-1', {
        baseVersionId: 'version-4',
      }),
    ).rejects.toMatchObject({ response: { code: 'stale-proposal' } });
    expect(review.approve).toHaveBeenCalledWith(org, 'proposal-1', {
      actorId: 'user-1',
      baseVersionId: 'version-4',
    });
    expect(review.lastDecision).not.toHaveBeenCalled();
  });
});

describe('ReviewController throttling', () => {
  const routes = ['findOne', 'approve', 'reject'] as const;

  function handler(name: (typeof routes)[number]): object {
    return (ReviewController.prototype as unknown as Record<string, object>)[
      name
    ];
  }

  it.each(routes)(
    'raises the per route and per address limits on %s',
    (route) => {
      expect(
        Reflect.getMetadata(
          `THROTTLER:LIMIT${DEFAULT_THROTTLER_NAME}`,
          handler(route),
        ),
      ).toBe(REVIEW_ROUTE_LIMIT);
      expect(
        Reflect.getMetadata(
          `THROTTLER:LIMIT${ADDRESS_THROTTLER_NAME}`,
          handler(route),
        ),
      ).toBe(REVIEW_ADDRESS_LIMIT);
      expect(
        Reflect.getMetadata(
          `THROTTLER:KEY_GENERATOR${ADDRESS_THROTTLER_NAME}`,
          handler(route),
        ),
      ).toEqual(expect.any(Function));
    },
  );
});
