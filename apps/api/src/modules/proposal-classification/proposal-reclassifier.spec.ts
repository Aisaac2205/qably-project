import { ProposalReclassifier } from './proposal-reclassifier';
import type { ReclassifySuiteJobData } from './proposal-classification.contracts';

type QueueAddCall = [string, ReclassifySuiteJobData, { jobId: string }];

function buildQueue() {
  const add = jest.fn<Promise<void>, QueueAddCall>().mockResolvedValue();
  return { add };
}

describe('ProposalReclassifier', () => {
  it('enqueues a reclassify job for the suite', async () => {
    const queue = buildQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [, data] = queue.add.mock.calls[0];
    expect(data).toEqual({ suiteId: 'suite-1' });
  });

  it('builds the same job id for the same suite, so BullMQ dedupes concurrent triggers', async () => {
    const queue = buildQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');
    await reclassifier.enqueue('suite-1');

    const [, , firstOpts] = queue.add.mock.calls[0];
    const [, , secondOpts] = queue.add.mock.calls[1];
    expect(firstOpts.jobId).toBe(secondOpts.jobId);
  });

  it('builds a different job id for a different suite', async () => {
    const queue = buildQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue('suite-1');
    await reclassifier.enqueue('suite-2');

    const [, , firstOpts] = queue.add.mock.calls[0];
    const [, , secondOpts] = queue.add.mock.calls[1];
    expect(firstOpts.jobId).not.toBe(secondOpts.jobId);
  });

  it('does nothing when suiteId is null', async () => {
    const queue = buildQueue();
    const reclassifier = new ProposalReclassifier(queue as never);

    await reclassifier.enqueue(null);

    expect(queue.add).not.toHaveBeenCalled();
  });
});
