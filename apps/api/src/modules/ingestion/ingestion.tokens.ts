import type { JobsOptions } from 'bullmq';

export const SCM_ADAPTERS = Symbol('SCM_ADAPTERS');
export const INGESTION_QUEUE = 'ingestion';

export const INGESTION_QUEUE_DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5_000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};
