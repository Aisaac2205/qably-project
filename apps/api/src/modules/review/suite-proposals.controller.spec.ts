import { ConflictException, NotFoundException } from '@nestjs/common';
import type { OrgContext } from '../organizations/organizations.contracts';
import { SuiteProposalsController } from './suite-proposals.controller';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

function fakeReview(result: unknown) {
  return {
    listSuiteProposals: jest.fn().mockResolvedValue(result),
    approveSuiteProposal: jest.fn().mockResolvedValue(result),
    rejectSuiteProposal: jest.fn().mockResolvedValue(result),
  };
}

function build(review: ReturnType<typeof fakeReview>) {
  return new SuiteProposalsController(review as never);
}

describe('SuiteProposalsController', () => {
  it('lists the suite proposals the service returns', async () => {
    const proposals = [{ id: 'suite-proposal-1' }];
    const review = fakeReview(proposals);

    const response = await build(review).list(org, {});

    expect(review.listSuiteProposals).toHaveBeenCalledWith(org, {});
    expect(response).toEqual(proposals);
  });

  it('throws a coded NotFoundException when the proposal does not exist', async () => {
    const review = fakeReview({ ok: false, error: 'not-found' });

    await expect(
      build(review).approve(org, 'suite-proposal-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws a coded ConflictException when the renamed suite collides with another suite', async () => {
    const review = fakeReview({ ok: false, error: 'suite-name-taken' });

    await expect(
      build(review).approve(org, 'suite-proposal-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(review).approve(org, 'suite-proposal-1'),
    ).rejects.toMatchObject({ response: { code: 'suite-name-taken' } });
  });

  it('rejects a suite proposal through the service', async () => {
    const decision = {
      proposalId: 'suite-proposal-1',
      projectId: 'project-1',
      applied: false,
      suiteId: 'suite-1',
      suiteName: 'Cart suite',
    };
    const review = fakeReview({ ok: true, value: decision });

    const response = await build(review).reject(org, 'suite-proposal-1');

    expect(review.rejectSuiteProposal).toHaveBeenCalledWith(
      org,
      'suite-proposal-1',
    );
    expect(response).toEqual(decision);
  });
});
