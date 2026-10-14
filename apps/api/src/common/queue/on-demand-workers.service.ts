import { getQueueToken } from '@nestjs/bullmq';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { DiscoveryService, ModuleRef } from '@nestjs/core';
import { Worker, type Queue } from 'bullmq';
import {
  ON_DEMAND_PROCESSOR,
  type OnDemandProcessorMetadata,
  type QueueProcessor,
} from './on-demand-processor.decorator';
import { OnDemandWorker, observeEnqueues } from './on-demand-worker';

/**
 * Gives every `@OnDemandProcessor` provider a worker that runs only while its
 * queue has work: started when this process enqueues a job or finds pending
 * jobs at boot, closed after an idle grace, closed on shutdown.
 */
@Injectable()
export class OnDemandWorkers
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(OnDemandWorkers.name);
  private readonly lifecycles: OnDemandWorker[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  onApplicationBootstrap(): void {
    for (const wrapper of this.discovery.getProviders({
      metadataKey: ON_DEMAND_PROCESSOR.KEY,
    })) {
      const metadata = this.discovery.getMetadataByDecorator(
        ON_DEMAND_PROCESSOR,
        wrapper,
      );
      const processor = wrapper.instance as Partial<QueueProcessor> | null;

      // A provider overridden with a plain value (as the e2e suites do) no
      // longer carries the metadata or a process method: it gets no worker.
      if (metadata === undefined || typeof processor?.process !== 'function') {
        continue;
      }

      if (!wrapper.isDependencyTreeStatic()) {
        throw new Error(
          `${wrapper.name} must not be request scoped to process queue jobs`,
        );
      }

      this.manage(metadata, processor as QueueProcessor);
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.lifecycles.map((lifecycle) => lifecycle.shutdown()));
  }

  private manage(
    { queueName, options }: OnDemandProcessorMetadata,
    processor: QueueProcessor,
  ): void {
    const queue = this.moduleRef.get<Queue>(getQueueToken(queueName), {
      strict: false,
    });

    const lifecycle = new OnDemandWorker({
      queue,
      logger: new Logger(`OnDemandWorker:${queueName}`),
      createWorker: () =>
        new Worker(queueName, (job) => processor.process(job), {
          connection: queue.opts.connection,
          prefix: queue.opts.prefix,
          telemetry: queue.opts.telemetry,
          ...options,
          // Listeners are attached before the lifecycle calls run().
          autorun: false,
        }),
    });

    observeEnqueues(queue, () => lifecycle.wake());
    this.lifecycles.push(lifecycle);

    // Never block application start on Redis: the boot check runs detached
    // and falls back to starting the worker when it cannot count the jobs.
    lifecycle.bootstrap().catch((error: unknown) => {
      this.logger.error(
        `Boot check failed for queue ${queueName}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }
}
