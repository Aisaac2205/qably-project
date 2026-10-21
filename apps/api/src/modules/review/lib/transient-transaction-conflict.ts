/**
 * Postgres aborts one of two transactions that wait on each other (deadlock,
 * SQLSTATE 40P01) or that cannot be serialized (40001). Running the losing
 * transaction again is the documented remedy, and it is safe for the jobs
 * that use this: their transaction rolled back whole, so a retry starts from
 * committed state.
 *
 * With `@prisma/client` 7.8.0 and `@prisma/adapter-pg` 7.9.1 (checked against
 * the installed runtime) the two reach the caller in three shapes:
 *
 * - 40001 on a model query: `PrismaClientKnownRequestError` with code `P2034`,
 *   because the adapter maps it to the kind `TransactionWriteConflict`.
 * - 40P01 on a model query: the adapter has no kind for it, Prisma assigns no
 *   code, and the raw `DriverAdapterError` is rethrown, carrying the SQLSTATE
 *   in `cause.originalCode`.
 * - Either one on a raw query (`$executeRawUnsafe`, `$queryRawUnsafe`):
 *   `P2010`, with the adapter error in `meta.driverAdapterError`.
 */
const TRANSIENT_SQLSTATES: ReadonlySet<string> = new Set(['40P01', '40001']);
const WRITE_CONFLICT_CODE = 'P2034';
const RAW_QUERY_FAILED_CODE = 'P2010';
const DRIVER_ADAPTER_ERROR = 'DriverAdapterError';

type Shape = Record<string, unknown>;

function asShape(value: unknown): Shape | null {
  return typeof value === 'object' && value !== null ? (value as Shape) : null;
}

function isTransientSqlState(value: unknown): boolean {
  return typeof value === 'string' && TRANSIENT_SQLSTATES.has(value);
}

function isTransientAdapterError(value: unknown): boolean {
  const error = asShape(value);
  if (error === null || error.name !== DRIVER_ADAPTER_ERROR) return false;

  const cause = asShape(error.cause);
  if (cause === null) return false;

  return (
    cause.kind === 'TransactionWriteConflict' ||
    isTransientSqlState(cause.originalCode) ||
    isTransientSqlState(cause.code)
  );
}

export function isTransientTransactionConflict(error: unknown): boolean {
  const shape = asShape(error);
  if (shape === null) return false;

  if (shape.code === WRITE_CONFLICT_CODE) return true;
  if (isTransientSqlState(shape.code)) return true;
  if (isTransientAdapterError(shape)) return true;

  if (shape.code === RAW_QUERY_FAILED_CODE) {
    return isTransientAdapterError(asShape(shape.meta)?.driverAdapterError);
  }

  return false;
}

const DEFAULT_ATTEMPTS = 3;
const BASE_DELAY_MS = 25;

export interface TransientRetryOptions {
  /** Total attempts, the first one included. */
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
}

function sleepFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `work` again when it loses a transaction conflict, up to `attempts`
 * times in all, waiting a growing delay with jitter in between so the two
 * contenders do not collide again in lockstep. Meant for one interactive
 * transaction: it rolled back whole, so running the same callback again is
 * safe, and nothing that ran before or after it is repeated. Any other error,
 * or the last conflict, is rethrown unchanged.
 */
export async function retryTransientConflicts<T>(
  work: () => Promise<T>,
  options: TransientRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;
  const sleep = options.sleep ?? sleepFor;
  const random = options.random ?? Math.random;

  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      if (attempt >= attempts || !isTransientTransactionConflict(error)) {
        throw error;
      }
      await sleep(BASE_DELAY_MS * 2 ** (attempt - 1) * (1 + random()));
    }
  }
}

/**
 * Thrown by a job that lost a transaction conflict, so BullMQ runs it again
 * (the extraction queue retries with backoff) instead of the job recording a
 * failure for work that would succeed on the next attempt.
 */
export class RetryableTransactionConflictError extends Error {
  constructor(work: string, cause: unknown) {
    super(`transaction-conflict: ${work} lost to a concurrent transaction`, {
      cause,
    });
    this.name = 'RetryableTransactionConflictError';
  }
}
