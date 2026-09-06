import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import { err, ok } from '../../common/result';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { RunIngestProcessor } from './run-ingest.processor';
import type { RunIngestJobData } from './runs.contracts';
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

function job(): Job<RunIngestJobData> {
  return { data: { apiKey, body } } as unknown as Job<RunIngestJobData>;
}

function build(ingestResult: unknown) {
  const runs = { ingest: jest.fn().mockResolvedValue(ingestResult) };
  const processor = new RunIngestProcessor(runs as never);

  return { processor, runs };
}

describe('RunIngestProcessor', () => {
  it('calls RunsService.ingest with the job payload on success', async () => {
    const { processor, runs } = build(ok({ id: 'run-1' }));

    await processor.process(job());

    expect(runs.ingest).toHaveBeenCalledWith(apiKey, body);
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
    const processor = new RunIngestProcessor(runs as never);

    await expect(processor.process(job())).rejects.toThrow('ECONNREFUSED');
    await expect(processor.process(job())).rejects.not.toBeInstanceOf(
      UnrecoverableError,
    );
  });
});
