import { Logger } from '@nestjs/common';
import { ProposalReclassifier } from './proposal-reclassifier';
import type { ReclassifySuiteJobData } from './proposal-classification.contracts';

interface DeduplicationOptions {
  id: string;
  keepLastIfActive?: boolean;
}

interface AddOptions {
  deduplication?: DeduplicationOptions;
}

type DedupEntryState = 'waiting' | 'active';

interface DedupEntry {
  state: DedupEntryState;
  data: ReclassifySuiteJobData;
  pendingRerun: boolean;
}

class FakeDedupQueue {
  private readonly entries = new Map<string, DedupEntry>();
  readonly addCalls: [string, ReclassifySuiteJobData, AddOptions][] = [];
  rejectNextAdd: Error | null = null;

  add = jest.fn(
    (
      name: string,
      data: ReclassifySuiteJobData,
      opts: AddOptions,
    ): Promise<void> => {
      this.addCalls.push([name, data, opts]);

      if (this.rejectNextAdd !== null) {
        const error = this.rejectNextAdd;
        this.rejectNextAdd = null;
        return Promise.reject(error);
      }

      const dedupId = opts.deduplication?.id;
      if (dedupId === undefined) {
        this.entries.set(`no-dedup-${this.entries.size}`, {
          state: 'waiting',
          data,
          pendingRerun: false,
        });
        return Promise.resolve();
      }

      const existing = this.entries.get(dedupId);

      if (existing === undefined) {
        this.entries.set(dedupId, {
          state: 'waiting',
          data,
          pendingRerun: false,
        });
        return Promise.resolve();
      }

      if (existing.state === 'waiting') {
        existing.data = data;
        return Promise.resolve();
      }

      if (opts.deduplication?.keepLastIfActive === true) {
        existing.pendingRerun = true;
        existing.data = data;
      }

      return Promise.resolve();
    },
  );

  markActive(dedupId: string): void {
    const entry = this.entries.get(dedupId);
    if (entry === undefined) throw new Error(`no job for ${dedupId}`);
    entry.state = 'active';
  }

  finishActive(dedupId: string): void {
    const entry = this.entries.get(dedupId);
    if (entry === undefined) throw new Error(`no job for ${dedupId}`);

    if (entry.pendingRerun) {
      this.entries.set(dedupId, {
        state: 'waiting',
        data: entry.data,
        pendingRerun: false,
      });
      return;
    }

    this.entries.delete(dedupId);
  }

  stateOf(dedupId: string): DedupEntryState | 'none' {
    return this.entries.get(dedupId)?.state ?? 'none';
  }

  waitingCount(): number {
    return [...this.entries.values()].filter(
      (entry) => entry.state === 'waiting',
    ).length;
  }
}

function dedupIdFor(reclassifier: ProposalReclassifier, suiteId: string) {
  return (
    reclassifier as unknown as { queue: FakeDedupQueue }
  ).queue.addCalls.find(([, data]) => data.suiteId === suiteId)?.[2]
    .deduplication?.id as string;
}

describe('ProposalReclassifier', () => {
  it('enqueues a reclassify job for the suite', async () => {
    const queue = new FakeDedupQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [, data] = queue.addCalls[0];
    expect(data).toEqual({ suiteId: 'suite-1' });
  });

  it('builds the same deduplication id for the same suite', async () => {
    const queue = new FakeDedupQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');
    await reclassifier.enqueue('suite-1');

    const [, , firstOpts] = queue.addCalls[0];
    const [, , secondOpts] = queue.addCalls[1];
    expect(firstOpts.deduplication?.id).toBe(secondOpts.deduplication?.id);
  });

  it('builds a different deduplication id for a different suite', async () => {
    const queue = new FakeDedupQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');
    await reclassifier.enqueue('suite-2');

    const [, , firstOpts] = queue.addCalls[0];
    const [, , secondOpts] = queue.addCalls[1];
    expect(firstOpts.deduplication?.id).not.toBe(secondOpts.deduplication?.id);
  });

  it('does nothing when suiteId is null', async () => {
    const queue = new FakeDedupQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue(null);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('coalesces a burst of triggers for the same suite into a single waiting job', async () => {
    const queue = new FakeDedupQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');
    await reclassifier.enqueue('suite-1');
    await reclassifier.enqueue('suite-1');

    expect(queue.add).toHaveBeenCalledTimes(3);
    expect(queue.waitingCount()).toBe(1);
  });

  it('queues exactly one more run when a trigger arrives while the suite job is active, so no update is lost', async () => {
    const queue = new FakeDedupQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');
    const dedupId = dedupIdFor(reclassifier, 'suite-1');
    queue.markActive(dedupId);

    await reclassifier.enqueue('suite-1');
    expect(queue.stateOf(dedupId)).toBe('active');

    queue.finishActive(dedupId);

    expect(queue.stateOf(dedupId)).toBe('waiting');
  });

  it('never blocks future triggers for a suite after its job fails', async () => {
    const queue = new FakeDedupQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');
    const dedupId = dedupIdFor(reclassifier, 'suite-1');
    queue.markActive(dedupId);
    queue.finishActive(dedupId);

    expect(queue.stateOf(dedupId)).toBe('none');

    await reclassifier.enqueue('suite-1');

    expect(queue.stateOf(dedupId)).toBe('waiting');
  });

  it('resolves without throwing and logs a warning when the queue rejects the enqueue', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const queue = new FakeDedupQueue();
    queue.rejectNextAdd = new Error('connection refused');
    const reclassifier = new ProposalReclassifier(queue as never);

    await expect(reclassifier.enqueue('suite-1')).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0] as [string];
    expect(message).toContain('suite-1');

    warnSpy.mockRestore();
  });
});
