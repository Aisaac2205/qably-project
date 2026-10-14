import { EventEmitter } from 'node:events';
import {
  IDLE_GRACE_MS,
  OnDemandWorker,
  PENDING_JOB_STATES,
  observeEnqueues,
  type JobCountSource,
  type ManagedWorker,
} from './on-demand-worker';

const EMPTY_COUNTS = {
  waiting: 0,
  active: 0,
  delayed: 0,
  prioritized: 0,
  'waiting-children': 0,
};

class FakeWorker extends EventEmitter implements ManagedWorker {
  private releaseRun: (() => void) | undefined;
  private releaseClose: (() => void) | undefined;
  holdClose = false;

  constructor(readonly index: number) {
    super();
  }

  readonly run = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        this.releaseRun = resolve;
      }),
  );

  readonly close = jest.fn(async () => {
    if (this.holdClose) {
      await new Promise<void>((resolve) => {
        this.releaseClose = resolve;
      });
    }
    this.releaseRun?.();
  });

  finishClose(): void {
    this.releaseClose?.();
  }
}

function fakeQueue(
  counts: Record<string, number> = EMPTY_COUNTS,
): JobCountSource & { getJobCounts: jest.Mock } {
  return { getJobCounts: jest.fn().mockResolvedValue(counts) };
}

function setup(
  counts?: Record<string, number>,
  onCreate: (worker: FakeWorker) => void = () => {},
) {
  const queue = fakeQueue(counts);
  const workers: FakeWorker[] = [];
  const logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const lifecycle = new OnDemandWorker({
    queue,
    logger,
    createWorker: () => {
      const worker = new FakeWorker(workers.length);
      onCreate(worker);
      workers.push(worker);
      return worker;
    },
  });

  return { queue, workers, lifecycle, logger };
}

describe('OnDemandWorker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts no worker at boot when the queue holds no pending work', async () => {
    const { queue, workers, lifecycle } = setup();

    await lifecycle.bootstrap();

    expect(queue.getJobCounts).toHaveBeenCalledWith(...PENDING_JOB_STATES);
    expect(workers).toHaveLength(0);
  });

  it('starts the worker at boot when the queue still holds pending work', async () => {
    const { workers, lifecycle } = setup({ ...EMPTY_COUNTS, active: 1 });

    await lifecycle.bootstrap();

    expect(workers).toHaveLength(1);
    expect(workers[0].run).toHaveBeenCalledTimes(1);
  });

  it('starts the worker at boot when the pending work cannot be counted', async () => {
    const { queue, workers, lifecycle } = setup();
    queue.getJobCounts.mockRejectedValueOnce(new Error('redis down'));

    await lifecycle.bootstrap();

    expect(workers).toHaveLength(1);
  });

  it('starts a single worker however many enqueues wake it', () => {
    const { workers, lifecycle } = setup();

    lifecycle.wake();
    lifecycle.wake();
    lifecycle.wake();

    expect(workers).toHaveLength(1);
    expect(workers[0].run).toHaveBeenCalledTimes(1);
  });

  it('stops the worker once it is drained and the queue stays empty for the idle grace', async () => {
    const { workers, lifecycle } = setup();
    lifecycle.wake();
    workers[0].emit('drained');

    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS - 1);
    expect(workers[0].close).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    expect(workers[0].close).toHaveBeenCalledTimes(1);
    expect(lifecycle.isRunning()).toBe(false);
  });

  it('keeps the worker running while delayed jobs are pending, and stops it once they are gone', async () => {
    const { queue, workers, lifecycle } = setup({
      ...EMPTY_COUNTS,
      delayed: 1,
    });
    lifecycle.wake();
    workers[0].emit('drained');

    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS * 3);
    expect(workers[0].close).not.toHaveBeenCalled();
    expect(lifecycle.isRunning()).toBe(true);

    queue.getJobCounts.mockResolvedValue(EMPTY_COUNTS);
    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS);
    expect(workers[0].close).toHaveBeenCalledTimes(1);
  });

  it('keeps the worker running when the pending work cannot be counted', async () => {
    const { queue, workers, lifecycle } = setup();
    queue.getJobCounts.mockRejectedValue(new Error('redis down'));
    lifecycle.wake();

    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS * 2);

    expect(workers[0].close).not.toHaveBeenCalled();
  });

  it('restarts the idle grace when a new enqueue arrives during it', async () => {
    const { workers, lifecycle } = setup();
    lifecycle.wake();
    workers[0].emit('drained');

    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS - 1_000);
    lifecycle.wake();
    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS - 1_000);

    expect(workers[0].close).not.toHaveBeenCalled();
    expect(workers).toHaveLength(1);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(workers[0].close).toHaveBeenCalledTimes(1);
  });

  it('does not stop the worker when an enqueue arrives while the pending work is being counted', async () => {
    const { queue, workers, lifecycle } = setup();
    let releaseCounts: (counts: Record<string, number>) => void = () => {};
    queue.getJobCounts.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseCounts = resolve;
      }),
    );
    lifecycle.wake();

    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS);
    lifecycle.wake();
    releaseCounts(EMPTY_COUNTS);
    await jest.advanceTimersByTimeAsync(0);

    expect(workers[0].close).not.toHaveBeenCalled();
  });

  it('starts a fresh worker after the stop completes when a wake arrives while stopping', async () => {
    const { workers, lifecycle } = setup();
    lifecycle.wake();
    workers[0].holdClose = true;

    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS);
    expect(workers[0].close).toHaveBeenCalledTimes(1);

    lifecycle.wake();
    expect(workers).toHaveLength(1);

    workers[0].finishClose();
    await jest.advanceTimersByTimeAsync(0);

    expect(workers).toHaveLength(2);
    expect(workers[1].run).toHaveBeenCalledTimes(1);
    expect(lifecycle.isRunning()).toBe(true);
  });

  it('closes the running worker on shutdown and ignores later wakes', async () => {
    const { workers, lifecycle } = setup();
    lifecycle.wake();

    await lifecycle.shutdown();
    lifecycle.wake();
    await jest.advanceTimersByTimeAsync(IDLE_GRACE_MS * 2);

    expect(workers).toHaveLength(1);
    expect(workers[0].close).toHaveBeenCalledTimes(1);
  });

  it('starts nothing on shutdown when no worker is running', async () => {
    const { workers, lifecycle } = setup();

    await lifecycle.shutdown();
    await lifecycle.bootstrap();

    expect(workers).toHaveLength(0);
  });

  it('retires a worker whose run loop fails, so the next wake starts a fresh one', async () => {
    const { workers, lifecycle, logger } = setup(EMPTY_COUNTS, (worker) => {
      if (worker.index === 0) {
        worker.run.mockRejectedValueOnce(new Error('connection lost'));
      }
    });
    lifecycle.wake();
    await jest.advanceTimersByTimeAsync(0);

    expect(logger.error).toHaveBeenCalled();
    expect(workers[0].close).toHaveBeenCalledTimes(1);
    expect(lifecycle.isRunning()).toBe(false);

    lifecycle.wake();
    expect(workers).toHaveLength(2);
    expect(lifecycle.isRunning()).toBe(true);
  });
});

describe('observeEnqueues', () => {
  function enqueueSource() {
    const source = Object.assign(new EventEmitter(), {
      addBulk: jest.fn().mockResolvedValue([{ id: 'job-1' }]),
    });
    return source;
  }

  it('reports every single add the queue announces as waiting', () => {
    const source = enqueueSource();
    const onEnqueue = jest.fn();
    observeEnqueues(source, onEnqueue);

    source.emit('waiting', { id: 'job-1' });

    expect(onEnqueue).toHaveBeenCalledTimes(1);
  });

  it('reports a bulk add once it resolves and returns its jobs unchanged', async () => {
    const source = enqueueSource();
    const original = source.addBulk;
    const onEnqueue = jest.fn();
    observeEnqueues(source, onEnqueue);

    const jobs = [{ name: 'a', data: {} }];
    await expect(source.addBulk(jobs)).resolves.toEqual([{ id: 'job-1' }]);

    expect(original).toHaveBeenCalledWith(jobs);
    expect(onEnqueue).toHaveBeenCalledTimes(1);
  });

  it('does not report a bulk add that fails', async () => {
    const source = enqueueSource();
    source.addBulk.mockRejectedValueOnce(new Error('redis down'));
    const onEnqueue = jest.fn();
    observeEnqueues(source, onEnqueue);

    await expect(source.addBulk([])).rejects.toThrow('redis down');

    expect(onEnqueue).not.toHaveBeenCalled();
  });
});
