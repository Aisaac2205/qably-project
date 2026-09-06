import { BadRequestException } from '@nestjs/common';
import { RunsController } from './runs.controller';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import type { RunIngestJobData } from './runs.contracts';
import { ingestJunitQuerySchema } from './runs.schemas';

const apiKey: ApiKeyIdentity = {
  apiKeyId: 'key-1',
  projectId: 'proj-1',
  organizationId: 'org-1',
};

const report = `<testsuite name="Checkout">
  <testcase name="accepts a valid card"/>
  <testcase name="rejects an expired card"><failure message="boom"/></testcase>
  <testcase name="handles 3D Secure"><skipped/></testcase>
</testsuite>`;

function build() {
  const runs = { ingest: jest.fn() };
  const runIngestQueue = { addBulk: jest.fn().mockResolvedValue([]) };

  return {
    controller: new RunsController(runs as never, runIngestQueue as never),
    runs,
    runIngestQueue,
  };
}

const query = (extra: Record<string, unknown> = {}) =>
  ingestJunitQuerySchema.parse({ externalId: 'ci-42', ...extra });

const multiSuiteReport = `<testsuites name="vitest tests">
  <testsuite name="src/a.test.ts"><testcase name="a1"/></testsuite>
  <testsuite name="src/b.test.ts"><testcase name="b1"/></testsuite>
  <testsuite name="src/c.test.ts"><testcase name="c1"/></testsuite>
</testsuites>`;

function jobBodies(runIngestQueue: { addBulk: jest.Mock }) {
  const [jobs] = runIngestQueue.addBulk.mock.calls[0] as [
    Array<{ data: RunIngestJobData; opts: { jobId: string } }>,
  ];
  return jobs;
}

describe('RunsController.ingestJunit', () => {
  it('answers 202 with the accepted shape and enqueues one job', async () => {
    const { controller, runIngestQueue } = build();

    const result = await controller.ingestJunit(apiKey, query(), report);

    expect(result.accepted).toBe(1);
    expect(result.runs).toEqual([
      { externalId: 'ci-42', suiteName: 'Checkout', jobId: 'proj-1:api:ci-42' },
    ]);
    expect(runIngestQueue.addBulk).toHaveBeenCalledTimes(1);
    expect(jobBodies(runIngestQueue)).toHaveLength(1);
  });

  it('builds job data with the api key and the validated ingest body, never the raw payload only', async () => {
    const { controller, runIngestQueue } = build();

    await controller.ingestJunit(apiKey, query(), report);

    const [job] = jobBodies(runIngestQueue);
    expect(job.data.apiKey).toBe(apiKey);
    expect(job.data.body.externalId).toBe('ci-42');
    expect(job.data.body.cases).toEqual([
      {
        name: 'accepts a valid card',
        suiteName: 'Checkout',
        status: 'pass',
        steps: [],
        expectedResult: '',
      },
      {
        name: 'rejects an expired card',
        suiteName: 'Checkout',
        status: 'fail',
        steps: [],
        expectedResult: '',
        failureMessage: 'boom',
      },
      {
        name: 'handles 3D Secure',
        suiteName: 'Checkout',
        status: 'skip',
        steps: [],
        expectedResult: '',
      },
    ]);
  });

  it('names the run after the report when the query omits a name', async () => {
    const { controller, runIngestQueue } = build();

    await controller.ingestJunit(apiKey, query(), report);

    const [job] = jobBodies(runIngestQueue);
    expect(job.data.body.name).toBe('Checkout');
    expect(job.data.body.suiteName).toBe('Checkout');
  });

  it('lets the query override the run name', async () => {
    const { controller, runIngestQueue } = build();

    await controller.ingestJunit(apiKey, query({ name: 'Nightly' }), report);

    const [job] = jobBodies(runIngestQueue);
    expect(job.data.body.name).toBe('Nightly');
  });

  it('sends suiteId through without a suiteName, as the schema demands', async () => {
    const { controller, runIngestQueue } = build();

    await controller.ingestJunit(apiKey, query({ suiteId: 'suite-9' }), report);

    const [job] = jobBodies(runIngestQueue);
    expect(job.data.body.suiteId).toBe('suite-9');
    expect(job.data.body.suiteName).toBeUndefined();
  });

  it('carries commit metadata from the query', async () => {
    const { controller, runIngestQueue } = build();

    await controller.ingestJunit(
      apiKey,
      query({ commitSha: 'a41f9c2' }),
      report,
    );

    const [job] = jobBodies(runIngestQueue);
    expect(job.data.body.commitSha).toBe('a41f9c2');
  });

  it('rejects a body that is not a string', async () => {
    const { controller } = build();

    await expect(
      controller.ingestJunit(apiKey, query(), { not: 'xml' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an empty body', async () => {
    const { controller } = build();

    await expect(
      controller.ingestJunit(apiKey, query(), '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('carries the parsed className, filePath, duration and failure details through to the enqueued job', async () => {
    const { controller, runIngestQueue } = build();
    const richReport = `<testsuite name="Checkout">
      <testcase classname="checkout.spec" name="accepts a valid card" file="e2e/checkout.spec.ts" time="0.5"/>
      <testcase classname="checkout.spec" name="rejects an expired card" time="0.2">
        <failure message="expected 200" type="AssertionError">at checkout.spec.ts:12</failure>
      </testcase>
      <testcase classname="checkout.spec" name="handles 3D Secure">
        <skipped message="requires network"/>
      </testcase>
    </testsuite>`;

    await controller.ingestJunit(apiKey, query(), richReport);

    const [job] = jobBodies(runIngestQueue);
    expect(job.data.body.cases[0]).toEqual(
      expect.objectContaining({
        className: 'checkout.spec',
        filePath: 'e2e/checkout.spec.ts',
        durationMs: 500,
      }),
    );
    expect(job.data.body.cases[1]).toEqual(
      expect.objectContaining({
        failureType: 'AssertionError',
        failureMessage: 'expected 200',
        failureDetails: 'at checkout.spec.ts:12',
      }),
    );
    expect(job.data.body.cases[2]).toEqual(
      expect.objectContaining({ skipReason: 'requires network' }),
    );
  });

  it('answers 400, not 500, when the xml is not a junit report', async () => {
    const { controller } = build();

    await expect(
      controller.ingestJunit(apiKey, query(), '<project><target/></project>'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps the externalId unchanged when the report has exactly one suite', async () => {
    const { controller, runIngestQueue } = build();

    const result = await controller.ingestJunit(apiKey, query(), report);

    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].externalId).toBe('ci-42');
    expect(jobBodies(runIngestQueue)).toHaveLength(1);
  });

  it('enqueues one job per <testsuite> when the report has several, one per file', async () => {
    const { controller, runIngestQueue } = build();

    const result = await controller.ingestJunit(
      apiKey,
      query(),
      multiSuiteReport,
    );

    expect(result.accepted).toBe(3);
    const jobs = jobBodies(runIngestQueue);
    expect(jobs).toHaveLength(3);
    expect(jobs.map((job) => job.data.body.suiteName)).toEqual([
      'src/a.test.ts',
      'src/b.test.ts',
      'src/c.test.ts',
    ]);
    expect(jobs.map((job) => job.data.body.name)).toEqual([
      'src/a.test.ts',
      'src/b.test.ts',
      'src/c.test.ts',
    ]);
    expect(jobs[0].data.body.cases).toHaveLength(1);
    expect(jobs[0].data.body.cases[0].name).toBe('a1');
    expect(jobs[1].data.body.cases[0].name).toBe('b1');
    expect(jobs[2].data.body.cases[0].name).toBe('c1');
  });

  it('derives a distinct externalId and jobId per suite when the report has several', async () => {
    const { controller } = build();

    const result = await controller.ingestJunit(
      apiKey,
      query(),
      multiSuiteReport,
    );

    const externalIds = result.runs.map((run) => run.externalId);
    const jobIds = result.runs.map((run) => run.jobId);
    expect(new Set(externalIds).size).toBe(3);
    expect(new Set(jobIds).size).toBe(3);
    for (const externalId of externalIds) {
      expect(externalId).toMatch(/^ci-42-[a-z0-9-]+-[0-9a-f]{8}$/);
    }
  });

  it('returns one run entry per suite group, in the same order', async () => {
    const { controller } = build();

    const result = await controller.ingestJunit(
      apiKey,
      query(),
      multiSuiteReport,
    );

    expect(result.runs).toHaveLength(3);
  });

  it('does not split by suite when the caller pins an explicit suiteId', async () => {
    const { controller, runIngestQueue } = build();

    await controller.ingestJunit(
      apiKey,
      query({ suiteId: 'suite-9' }),
      multiSuiteReport,
    );

    const jobs = jobBodies(runIngestQueue);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.body.suiteId).toBe('suite-9');
    expect(jobs[0].data.body.cases).toHaveLength(3);
  });

  it('does not split by suite when the caller pins an explicit suiteName', async () => {
    const { controller, runIngestQueue } = build();

    await controller.ingestJunit(
      apiKey,
      query({ suiteName: 'Pinned Suite' }),
      multiSuiteReport,
    );

    const jobs = jobBodies(runIngestQueue);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.body.suiteName).toBe('Pinned Suite');
    expect(jobs[0].data.body.cases).toHaveLength(3);
  });

  it('produces the same deterministic jobId for the same project, source and externalId', async () => {
    const { controller, runIngestQueue } = build();

    await controller.ingestJunit(apiKey, query(), report);
    const [firstJob] = jobBodies(runIngestQueue);

    runIngestQueue.addBulk.mockClear();
    await controller.ingestJunit(apiKey, query(), report);
    const [secondJob] = jobBodies(runIngestQueue);

    expect(firstJob.opts.jobId).toBe(secondJob.opts.jobId);
  });

  it('rejects the whole request with 400 and enqueues nothing when a group fails ingest validation', async () => {
    const { controller, runIngestQueue } = build();
    // The query type only allows a name up to 200 chars through its own schema; this
    // simulates a future drift between ingestJunitQuerySchema and ingestRunSchema by
    // crafting a query object that bypasses that guard, so the per-group safeParse
    // guard in the controller is the one that actually catches it.
    const invalidQuery = { ...query(), name: 'x'.repeat(300) };

    await expect(
      controller.ingestJunit(apiKey, invalidQuery, multiSuiteReport),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(runIngestQueue.addBulk).not.toHaveBeenCalled();
  });

  it('names the failing suite in the validation error', async () => {
    const { controller } = build();
    const invalidQuery = { ...query(), name: 'x'.repeat(300) };

    try {
      await controller.ingestJunit(apiKey, invalidQuery, report);
      throw new Error('expected ingestJunit to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as {
        message: string;
      };
      expect(response.message).toContain('Checkout');
    }
  });
});
