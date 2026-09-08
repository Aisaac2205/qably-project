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
