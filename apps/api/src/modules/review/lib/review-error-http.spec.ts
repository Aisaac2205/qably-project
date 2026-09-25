import { ConflictException, NotFoundException } from '@nestjs/common';
import { err, ok } from '../../../common/result';
import type { LastDecisionView } from '../review.contracts';
import { unwrapDecision } from './review-error-http';

describe('unwrapDecision', () => {
  it('returns the ok value without calling lastDecision', async () => {
    const lastDecision = jest.fn();

    const value = await unwrapDecision(
      ok({ decisionId: 'decision-1' }),
      lastDecision,
    );

    expect(value).toEqual({ decisionId: 'decision-1' });
    expect(lastDecision).not.toHaveBeenCalled();
  });

  it('throws a coded ConflictException carrying the last decision on invalid-transition', async () => {
    const decision: LastDecisionView = {
      action: 'approved',
      decidedAt: '2026-01-05T12:00:00.000Z',
      decidedBy: { id: 'user-2', name: 'Grace Hopper' },
    };
    const lastDecision = jest.fn().mockResolvedValue(decision);

    await expect(
      unwrapDecision(err('invalid-transition'), lastDecision),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      unwrapDecision(err('invalid-transition'), lastDecision),
    ).rejects.toMatchObject({
      response: { code: 'invalid-transition', decision },
    });
  });

  it('carries a null decision when none was recorded', async () => {
    const lastDecision = jest.fn().mockResolvedValue(null);

    await expect(
      unwrapDecision(err('invalid-transition'), lastDecision),
    ).rejects.toMatchObject({ response: { decision: null } });
  });

  it('delegates every other error to the plain unwrap mapping', async () => {
    const lastDecision = jest.fn();

    await expect(
      unwrapDecision(err('not-found'), lastDecision),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(lastDecision).not.toHaveBeenCalled();
  });
});
