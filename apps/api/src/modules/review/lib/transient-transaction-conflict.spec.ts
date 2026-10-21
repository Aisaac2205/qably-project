import { Prisma } from '../../../../generated/prisma/client';
import {
  RetryableTransactionConflictError,
  isTransientTransactionConflict,
  retryTransientConflicts,
} from './transient-transaction-conflict';

/**
 * The shapes below are the ones the installed runtime produces
 * (`@prisma/client` 7.8.0 with `@prisma/adapter-pg` 7.9.1), read from its
 * error mapping: the adapter maps SQLSTATE 40001 to the kind
 * `TransactionWriteConflict` and leaves 40P01 as a generic `postgres` error.
 */
class DriverAdapterError extends Error {
  override readonly name = 'DriverAdapterError';
  override readonly cause: Record<string, unknown>;

  constructor(cause: Record<string, unknown>) {
    super(String(cause.kind));
    this.cause = cause;
  }
}

function deadlockCause() {
  return {
    kind: 'postgres',
    code: '40P01',
    originalCode: '40P01',
    originalMessage: 'deadlock detected',
    severity: 'ERROR',
    message: 'deadlock detected',
  };
}

function knownRequestError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('Query failed', {
    code,
    clientVersion: '7.8.0',
    meta,
  });
}

describe('isTransientTransactionConflict', () => {
  it('recognizes a deadlock on a model query, which reaches the caller as the raw adapter error', () => {
    expect(
      isTransientTransactionConflict(new DriverAdapterError(deadlockCause())),
    ).toBe(true);
  });

  it('recognizes a deadlock on a raw query, which Prisma wraps as P2010', () => {
    const error = knownRequestError('P2010', {
      driverAdapterError: new DriverAdapterError(deadlockCause()),
    });

    expect(isTransientTransactionConflict(error)).toBe(true);
  });

  it('recognizes a serialization failure on a model query, reported as P2034', () => {
    expect(isTransientTransactionConflict(knownRequestError('P2034'))).toBe(
      true,
    );
  });

  it('recognizes a serialization failure on a raw query', () => {
    const error = knownRequestError('P2010', {
      driverAdapterError: new DriverAdapterError({
        kind: 'TransactionWriteConflict',
        originalCode: '40001',
        originalMessage: 'could not serialize access',
      }),
    });

    expect(isTransientTransactionConflict(error)).toBe(true);
  });

  it('recognizes a bare pg error carrying the deadlock SQLSTATE', () => {
    expect(
      isTransientTransactionConflict(
        Object.assign(new Error('deadlock detected'), { code: '40P01' }),
      ),
    ).toBe(true);
  });

  it.each([
    ['a unique violation', knownRequestError('P2002')],
    [
      'another raw query failure',
      knownRequestError('P2010', {
        driverAdapterError: new DriverAdapterError({
          kind: 'postgres',
          originalCode: '42P01',
        }),
      }),
    ],
    ['a plain error that only mentions a deadlock', new Error('deadlock')],
    ['a non-error value', 'deadlock'],
    ['null', null],
  ])('ignores %s', (_label, error) => {
    expect(isTransientTransactionConflict(error)).toBe(false);
  });
});

describe('retryTransientConflicts', () => {
  const noWait = () => Promise.resolve();

  it('returns the result of the first attempt that succeeds', async () => {
    const work = jest
      .fn()
      .mockRejectedValueOnce(new DriverAdapterError(deadlockCause()))
      .mockResolvedValue('committed');

    await expect(
      retryTransientConflicts(work, { attempts: 3, sleep: noWait }),
    ).resolves.toBe('committed');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('rethrows the last conflict once the attempts run out', async () => {
    const conflict = knownRequestError('P2034');
    const work = jest.fn().mockRejectedValue(conflict);

    await expect(
      retryTransientConflicts(work, { attempts: 3, sleep: noWait }),
    ).rejects.toBe(conflict);
    expect(work).toHaveBeenCalledTimes(3);
  });

  it('never retries an error that is not a transaction conflict', async () => {
    const work = jest.fn().mockRejectedValue(new Error('boom'));

    await expect(
      retryTransientConflicts(work, { attempts: 3, sleep: noWait }),
    ).rejects.toThrow('boom');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('waits a jittered, growing delay between attempts', async () => {
    const sleep = jest.fn().mockResolvedValue(undefined);
    const work = jest.fn().mockRejectedValue(knownRequestError('P2034'));

    await retryTransientConflicts(work, {
      attempts: 3,
      sleep,
      random: () => 0.5,
    }).catch(() => undefined);

    expect(sleep.mock.calls).toEqual([[37.5], [75]]);
  });
});

describe('RetryableTransactionConflictError', () => {
  it('keeps the original error as its cause', () => {
    const original = new DriverAdapterError(deadlockCause());

    const error = new RetryableTransactionConflictError(
      'documenting src/cart.spec.ts',
      original,
    );

    expect(error.cause).toBe(original);
    expect(error.message).toBe(
      'transaction-conflict: documenting src/cart.spec.ts lost to a concurrent transaction',
    );
  });
});
