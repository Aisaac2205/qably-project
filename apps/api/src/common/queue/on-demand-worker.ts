/**
 * Idle time after the last sign of activity before a worker is closed. Long
 * enough that a burst of enqueues reuses one worker instead of flapping it.
 */
export const IDLE_GRACE_MS = 30_000;

/**
 * Job states that still need a worker. Delayed jobs cover backoff retries and
 * scheduled timeouts; active jobs cover work a crashed process left behind,
 * which only a running worker's stalled checker can recover.
 */
export const PENDING_JOB_STATES = [
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
] as const;

/** The slice of a BullMQ `Worker` the lifecycle drives. */
export interface ManagedWorker {
  on(event: 'drained', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  run(): Promise<void>;
  close(): Promise<void>;
}

/** The slice of a BullMQ `Queue` used to decide whether work is pending. */
export interface JobCountSource {
  getJobCounts(...types: string[]): Promise<Record<string, number>>;
}

/** The slice of a BullMQ `Queue` that announces in-process enqueues. */
export interface EnqueueSource {
  on(event: 'waiting', listener: () => void): unknown;
  addBulk(...args: never[]): Promise<unknown>;
}

export interface LifecycleLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

export interface OnDemandWorkerDeps {
  queue: JobCountSource;
  createWorker: () => ManagedWorker;
  logger: LifecycleLogger;
  idleGraceMs?: number;
}

/**
 * Calls `onEnqueue` after every job this process adds to the queue.
 *
 * BullMQ's `Queue.add` emits a local `waiting` event once the job is stored,
 * but `Queue.addBulk` emits nothing, so the instance's `addBulk` is wrapped to
 * report the same way. Jobs added by other processes are not observed.
 */
export function observeEnqueues(
  queue: EnqueueSource,
  onEnqueue: () => void,
): void {
  queue.on('waiting', () => onEnqueue());

  const addBulk = queue.addBulk.bind(queue) as (
    ...args: unknown[]
  ) => Promise<unknown>;

  queue.addBulk = async (...args: unknown[]) => {
    const jobs = await addBulk(...args);
    onEnqueue();
    return jobs;
  };
}

/**
 * Runs a queue's worker only while the queue has work.
 *
 * An idle BullMQ worker keeps issuing a blocking pop every few seconds and a
 * stalled-jobs check every 30 s, so a platform that sleeps idle services never
 * sees the API or Redis go quiet. This lifecycle starts a fresh worker when the
 * process enqueues a job (or finds pending work at boot) and closes it once the
 * queue holds no pending job for a full idle grace. A closed BullMQ worker
 * cannot run again, so every wake cycle builds a new one.
 */
export class OnDemandWorker {
  private readonly idleGraceMs: number;
  private worker: ManagedWorker | undefined;
  private stopping: Promise<void> | undefined;
  private idleTimer: NodeJS.Timeout | undefined;
  private wakeAfterStop = false;
  private shutDown = false;

  constructor(private readonly deps: OnDemandWorkerDeps) {
    this.idleGraceMs = deps.idleGraceMs ?? IDLE_GRACE_MS;
  }

  isRunning(): boolean {
    return this.worker !== undefined && this.stopping === undefined;
  }

  /**
   * Starts the worker when the queue already holds work from before this
   * process started. If the work cannot be counted it starts anyway: the idle
   * check closes it again once the queue is known to be empty.
   */
  async bootstrap(): Promise<void> {
    let pending: boolean;

    try {
      pending = await this.hasPendingWork();
    } catch (error) {
      this.deps.logger.warn(
        `Could not count pending jobs at boot, starting the worker: ${messageOf(error)}`,
      );
      pending = true;
    }

    if (pending) this.wake();
  }

  /** Ensures a worker is running. Safe to call any number of times. */
  wake(): void {
    if (this.shutDown) return;

    if (this.stopping !== undefined) {
      this.wakeAfterStop = true;
      return;
    }

    if (this.worker !== undefined) {
      this.armIdleCheck();
      return;
    }

    this.start();
  }

  async shutdown(): Promise<void> {
    this.shutDown = true;
    this.clearIdleCheck();

    if (this.stopping !== undefined) {
      await this.stopping;
      return;
    }

    if (this.worker !== undefined) await this.stop(this.worker);
  }

  private start(): void {
    const worker = this.deps.createWorker();
    this.worker = worker;

    worker.on('drained', () => {
      if (this.worker === worker) this.armIdleCheck();
    });
    worker.on('error', (error) => {
      this.deps.logger.error(`Worker error: ${messageOf(error)}`);
    });

    worker.run().catch((error: unknown) => {
      this.deps.logger.error(
        `Worker stopped unexpectedly: ${messageOf(error)}`,
      );
      if (this.worker === worker && this.stopping === undefined) {
        void this.stop(worker);
      }
    });

    this.deps.logger.log('Worker started');
    this.armIdleCheck();
  }

  private armIdleCheck(): void {
    this.clearIdleCheck();
    this.idleTimer = setTimeout(() => void this.checkIdle(), this.idleGraceMs);
  }

  private clearIdleCheck(): void {
    if (this.idleTimer !== undefined) clearTimeout(this.idleTimer);
    this.idleTimer = undefined;
  }

  private async checkIdle(): Promise<void> {
    this.idleTimer = undefined;
    const worker = this.worker;
    if (worker === undefined || this.stopping !== undefined) return;

    let pending: boolean;

    try {
      pending = await this.hasPendingWork();
    } catch (error) {
      this.deps.logger.warn(
        `Could not count pending jobs, keeping the worker: ${messageOf(error)}`,
      );
      pending = true;
    }

    // A wake or a drain during the count re-armed the grace: honour it.
    if (this.idleTimer !== undefined || this.worker !== worker) return;
    if (this.shutDown) return;

    if (pending) {
      this.armIdleCheck();
      return;
    }

    await this.stop(worker);
  }

  private async stop(worker: ManagedWorker): Promise<void> {
    this.clearIdleCheck();

    this.stopping = worker.close().catch((error: unknown) => {
      this.deps.logger.error(`Failed to close the worker: ${messageOf(error)}`);
    });
    await this.stopping;

    this.worker = undefined;
    this.stopping = undefined;
    this.deps.logger.log('Worker stopped');

    if (this.wakeAfterStop) {
      this.wakeAfterStop = false;
      this.wake();
    }
  }

  private async hasPendingWork(): Promise<boolean> {
    const counts = await this.deps.queue.getJobCounts(...PENDING_JOB_STATES);
    return Object.values(counts).some((count) => count > 0);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
