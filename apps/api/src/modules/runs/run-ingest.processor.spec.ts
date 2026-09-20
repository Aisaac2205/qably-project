import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import { err, ok } from '../../common/result';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { RunIngestProcessor } from './run-ingest.processor';
import {
  REPORT_BATCH_TIMEOUT_JOB,
  type ReportBatchTimeoutJobData,
  type RunIngestJobData,
} from './runs.contracts';
import type { IngestRunInput } from './runs.schemas';

const apiKey: ApiKeyIdentity = {
  apiKeyId: 'key-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
};

const body = {
  externalId: 'ci-42',
  source: 'api',
  suiteId: 'suite-1',
  name: 'Checkout',
  cases: [{ name: 'a', status: 'pass', steps: [], expectedResult: '' }],
} as unknown as IngestRunInput;

function job(reportSize = 1): Job<RunIngestJobData> {
  return {
    name: 'ingest',
    data: { apiKey, body, reportSize },
  } as unknown as Job<RunIngestJobData>;
}

function timeoutJob(key: string): Job<ReportBatchTimeoutJobData> {
  return {
    name: REPORT_BATCH_TIMEOUT_JOB,
    data: { key },
  } as unknown as Job<ReportBatchTimeoutJobData>;
}

function build(ingestResult: unknown) {
  const runs = { ingest: jest.fn().mockResolvedValue(ingestResult) };
  const reportBatch = {
    flushIfPending: jest.fn().mockResolvedValue(undefined),
  };
  const processor = new RunIngestProcessor(runs as never, reportBatch as never);

  return { processor, runs, reportBatch };
}

describe('RunIngestProcessor', () => {
  it('calls RunsService.ingest with the job payload on success', async () => {
    const { processor, runs } = build(ok({ id: 'run-1' }));

    await processor.process(job(1));

    expect(runs.ingest).toHaveBeenCalledWith(apiKey, body, 1);
  });

  it('throws an UnrecoverableError, not a plain error, for a business rejection', async () => {
    const { processor } = build(err('suite-not-found'));

    await expect(processor.process(job())).rejects.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('carries the business error code on the UnrecoverableError message', async () => {
    const { processor } = build(err('source-not-allowed'));

    await expect(processor.process(job())).rejects.toThrow(
      'source-not-allowed',
    );
  });

  it('propagates an infrastructure error so BullMQ retries', async () => {
    const runs = {
      ingest: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };
    const reportBatch = { flushIfPending: jest.fn() };
    const processor = new RunIngestProcessor(
      runs as never,
      reportBatch as never,
    );

    await expect(processor.process(job())).rejects.toThrow('ECONNREFUSED');
    await expect(processor.process(job())).rejects.not.toBeInstanceOf(
      UnrecoverableError,
    );
  });

  it('routes a report-batch-timeout job to the report batch flush, never to RunsService.ingest', async () => {
    const { processor, runs, reportBatch } = build(ok({ id: 'run-1' }));

    await processor.process(timeoutJob('report-batch:org-1:proj-1:api:ci-42'));

    expect(reportBatch.flushIfPending).toHaveBeenCalledWith(
      'report-batch:org-1:proj-1:api:ci-42',
    );
    expect(runs.ingest).not.toHaveBeenCalled();
  });
});
