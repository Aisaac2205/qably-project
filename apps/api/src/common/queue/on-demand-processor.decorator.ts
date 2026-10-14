import { applyDecorators, Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import type { Job, WorkerOptions } from 'bullmq';

/** Worker options a processor may set; the connection comes from its queue. */
export type OnDemandProcessorOptions = Omit<
  WorkerOptions,
  'connection' | 'autorun' | 'prefix' | 'telemetry'
>;

export interface OnDemandProcessorMetadata {
  queueName: string;
  options: OnDemandProcessorOptions;
}

/** A provider that handles the jobs of one queue. */
export interface QueueProcessor {
  process(job: Job): Promise<unknown>;
}

export const ON_DEMAND_PROCESSOR =
  DiscoveryService.createDecorator<OnDemandProcessorMetadata>();

/**
 * Marks a provider as the processor of `queueName`. Unlike `@Processor` from
 * `@nestjs/bullmq`, which starts an always-on worker at boot, its worker only
 * runs while the queue has work (see `OnDemandWorkers`).
 */
export function OnDemandProcessor(
  queueName: string,
  options: OnDemandProcessorOptions = {},
): ClassDecorator {
  return applyDecorators(
    Injectable(),
    ON_DEMAND_PROCESSOR({ queueName, options }),
  );
}
