import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { OrgContext } from '../organizations/organizations.contracts';
import type { AuthenticatedUser } from '../auth/auth.contracts';
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
    const review = fakeReview({ ok: false, error: 'name-taken' });

    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toMatchObject({ response: { code: 'name-taken' } });
  });
});
