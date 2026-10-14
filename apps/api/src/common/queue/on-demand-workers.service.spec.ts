import { EventEmitter } from 'node:events';
import { getQueueToken } from '@nestjs/bullmq';
import { DiscoveryModule } from '@nestjs/core';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { Job } from 'bullmq';
import { OnDemandProcessor } from './on-demand-processor.decorator';
import { OnDemandWorkers } from './on-demand-workers.service';
import { PENDING_JOB_STATES } from './on-demand-worker';

const QUEUE = 'on-demand-test';

@OnDemandProcessor(QUEUE, { concurrency: 3 })
class TestProcessor {
  async process(job: Job): Promise<string> {
    return await Promise.resolve(String(job.id));
  }
}

function fakeQueue() {
  return Object.assign(new EventEmitter(), {
    name: QUEUE,
    opts: { connection: {} },
    addBulk: jest.fn().mockResolvedValue([]),
    getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0 }),
  });
}

async function boot(
  queue: ReturnType<typeof fakeQueue>,
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
) {
  const moduleRef = await override(
    Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [
        OnDemandWorkers,
        TestProcessor,
        { provide: getQueueToken(QUEUE), useValue: queue },
      ],
    }),
  ).compile();

  await moduleRef.init();
  return moduleRef;
}

describe('OnDemandWorkers', () => {
  it('checks every on-demand processor queue for pending work at boot without starting an idle worker', async () => {
    const queue = fakeQueue();
    const moduleRef = await boot(queue);

    expect(queue.getJobCounts).toHaveBeenCalledWith(...PENDING_JOB_STATES);
    expect(queue.listenerCount('waiting')).toBe(1);

    await moduleRef.close();
  });

  it('leaves a processor overridden with a plain value without a worker', async () => {
    const queue = fakeQueue();
    const originalAddBulk = queue.addBulk;
    const moduleRef = await boot(queue, (builder) =>
      builder.overrideProvider(TestProcessor).useValue({}),
    );

    expect(queue.getJobCounts).not.toHaveBeenCalled();
    expect(queue.listenerCount('waiting')).toBe(0);
    expect(queue.addBulk).toBe(originalAddBulk);

    await moduleRef.close();
  });
});
