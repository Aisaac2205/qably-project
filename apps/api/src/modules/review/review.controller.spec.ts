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

function fakeReview(result: unknown) {
  return {
    findOne: jest.fn().mockResolvedValue(result),
    approve: jest.fn().mockResolvedValue(result),
    reject: jest.fn().mockResolvedValue(result),
    approveMany: jest.fn().mockResolvedValue(result),
    rejectMany: jest.fn().mockResolvedValue(result),
    getDuplicateCandidates: jest.fn().mockResolvedValue(result),
  };
}

function build(review: ReturnType<typeof fakeReview>) {
  return new ReviewController(review as never);
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

  it('throws a coded ConflictException when the proposal was already decided', async () => {
    const review = fakeReview({ ok: false, error: 'invalid-transition' });

    await expect(
      build(review).approve(org, user, 'proposal-1', {}),
    ).rejects.toMatchObject({ response: { code: 'invalid-transition' } });
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

describe('ReviewController duplicates', () => {
  it('throws a coded NotFoundException when the proposal is outside the organization', async () => {
    const review = fakeReview({ ok: false, error: 'not-found' });

    await expect(
      build(review).duplicates(org, 'proposal-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the ranked candidates the service produces', async () => {
    const candidates = [
      {
        id: 'case-1',
        title: 'Empties the cart',
        steps: ['Open the cart'],
        expectedResult: 'The cart is empty',
        matchReason: 'title' as const,
      },
    ];
    const review = fakeReview({ ok: true, value: candidates });

    const response = await build(review).duplicates(org, 'proposal-1');

    expect(review.getDuplicateCandidates).toHaveBeenCalledWith(
      org,
      'proposal-1',
    );
    expect(response).toEqual(candidates);
  });

  it('returns an empty array when the proposal has no plausible duplicates', async () => {
    const review = fakeReview({ ok: true, value: [] });

    const response = await build(review).duplicates(org, 'proposal-1');

    expect(response).toEqual([]);
  });
});

describe('ReviewController bulk decisions', () => {
  it('forwards the id list to approveMany and returns the per-item results', async () => {
    const results = [
      { id: 'proposal-1', outcome: 'approved' },
      { id: 'proposal-2', outcome: 'skipped', reason: 'invalid-transition' },
    ];
    const review = fakeReview(results);

    const response = await build(review).approveMany(org, user, {
      ids: ['proposal-1', 'proposal-2'],
    });

    expect(review.approveMany).toHaveBeenCalledWith(
      org,
      ['proposal-1', 'proposal-2'],
      {
        actorId: 'user-1',
      },
    );
    expect(response).toEqual(results);
  });

  it('forwards the id list to rejectMany and returns the per-item results', async () => {
    const results = [{ id: 'proposal-1', outcome: 'rejected' }];
    const review = fakeReview(results);

    const response = await build(review).rejectMany(org, user, {
      ids: ['proposal-1'],
    });

    expect(review.rejectMany).toHaveBeenCalledWith(org, ['proposal-1'], {
      actorId: 'user-1',
    });
    expect(response).toEqual(results);
  });
});
