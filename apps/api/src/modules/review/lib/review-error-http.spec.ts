import { ConflictException, NotFoundException } from '@nestjs/common';
import { err, ok } from '../../../common/result';
import type { LastDecisionView } from '../review.contracts';
import { unwrap, unwrapDecision } from './review-error-http';

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

  it.each([
    [
      'name-taken',
      'Another official case in this suite already uses that title',
    ],
    [
      'automation-key-taken',
      'Another official case in this suite already runs as that automated test',
    ],
    [
      'publish-conflict',
      'Publishing collided with another change to the official cases. Try again',
    ],
  ] as const)(
    'throws a 409 whose body carries the %s code, a safe message and the conflicting case',
    async (code, message) => {
      const conflictingCase = {
        id: 'case-1',
        name: 'Empties the cart',
        suiteId: 'suite-1',
      };
      const lastDecision = jest.fn();

      const thrown: unknown = await unwrapDecision(
        err({ code, conflictingCase }),
        lastDecision,
      ).catch((error: unknown) => error);

      expect(thrown).toBeInstanceOf(ConflictException);
      expect((thrown as ConflictException).getResponse()).toEqual({
        code,
        message,
        conflictingCase,
      });
      expect(lastDecision).not.toHaveBeenCalled();
    },
  );

  it('carries a null conflicting case when none could be resolved', () => {
    expect(() =>
      unwrap(err({ code: 'publish-conflict', conflictingCase: null })),
    ).toThrow(
      expect.objectContaining({
        response: expect.objectContaining({ conflictingCase: null }) as unknown,
      }) as Error,
    );
  });

  it('delegates every other error to the plain unwrap mapping', async () => {
    const lastDecision = jest.fn();

    await expect(
      unwrapDecision(err('not-found'), lastDecision),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(lastDecision).not.toHaveBeenCalled();
  });
});
