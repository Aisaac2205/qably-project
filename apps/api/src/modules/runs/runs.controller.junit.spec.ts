import { BadRequestException } from '@nestjs/common';
import { RunsController } from './runs.controller';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import type { RunView } from './runs.contracts';
import type { IngestRunInput } from './runs.schemas';
import { ingestJunitQuerySchema } from './runs.schemas';

const apiKey = { projectId: 'proj-1', apiKeyId: 'key-1' } as ApiKeyIdentity;

const report = `<testsuite name="Checkout">
  <testcase name="accepts a valid card"/>
  <testcase name="rejects an expired card"><failure message="boom"/></testcase>
  <testcase name="handles 3D Secure"><skipped/></testcase>
</testsuite>`;

function build() {
  const ingested: IngestRunInput[] = [];
  const runs = {
    ingest: jest.fn((_key: ApiKeyIdentity, body: IngestRunInput) => {
      ingested.push(body);
      return Promise.resolve({
        value: { id: `run-${ingested.length}` } as unknown as RunView,
      });
    }),
  };

  return { controller: new RunsController(runs as never), ingested };
}

const query = (extra: Record<string, unknown> = {}) =>
  ingestJunitQuerySchema.parse({ externalId: 'ci-42', ...extra });

const multiSuiteReport = `<testsuites name="vitest tests">
  <testsuite name="src/a.test.ts"><testcase name="a1"/></testsuite>
  <testsuite name="src/b.test.ts"><testcase name="b1"/></testsuite>
  <testsuite name="src/c.test.ts"><testcase name="c1"/></testsuite>
</testsuites>`;

describe('RunsController.ingestJunit', () => {
  it('turns a JUnit report into ingestion cases', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(apiKey, query(), report);

    expect(ingested[0].cases).toEqual([
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

  it('names the run and the suite after the report when the query omits them', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(apiKey, query(), report);

    expect(ingested[0].name).toBe('Checkout');
    expect(ingested[0].suiteName).toBe('Checkout');
  });

  it('lets the query override the run name', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(apiKey, query({ name: 'Nightly' }), report);

    expect(ingested[0].name).toBe('Nightly');
  });

  it('sends suiteId through without a suiteName, as the schema demands', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(apiKey, query({ suiteId: 'suite-9' }), report);

    expect(ingested[0].suiteId).toBe('suite-9');
    expect(ingested[0].suiteName).toBeUndefined();
  });

  it('carries commit metadata from the query', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(
      apiKey,
      query({ commitSha: 'a41f9c2' }),
      report,
    );

    expect(ingested[0].commitSha).toBe('a41f9c2');
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

  it('carries the parsed className, filePath, duration and failure details through to ingestion', async () => {
    const { controller, ingested } = build();
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

    expect(ingested[0].cases[0]).toEqual(
      expect.objectContaining({
        className: 'checkout.spec',
        filePath: 'e2e/checkout.spec.ts',
        durationMs: 500,
      }),
    );
    expect(ingested[0].cases[1]).toEqual(
      expect.objectContaining({
        failureType: 'AssertionError',
        failureMessage: 'expected 200',
        failureDetails: 'at checkout.spec.ts:12',
      }),
    );
    expect(ingested[0].cases[2]).toEqual(
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
    const { controller, ingested } = build();

    await controller.ingestJunit(apiKey, query(), report);

    expect(ingested).toHaveLength(1);
    expect(ingested[0].externalId).toBe('ci-42');
  });

  it('creates one run per <testsuite> when the report has several, one per file', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(apiKey, query(), multiSuiteReport);

    expect(ingested).toHaveLength(3);
    expect(ingested.map((body) => body.suiteName)).toEqual([
      'src/a.test.ts',
      'src/b.test.ts',
      'src/c.test.ts',
    ]);
    expect(ingested.map((body) => body.name)).toEqual([
      'src/a.test.ts',
      'src/b.test.ts',
      'src/c.test.ts',
    ]);
    expect(ingested[0].cases).toHaveLength(1);
    expect(ingested[0].cases[0].name).toBe('a1');
    expect(ingested[1].cases[0].name).toBe('b1');
    expect(ingested[2].cases[0].name).toBe('c1');
  });

  it('derives a distinct externalId per suite when the report has several', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(apiKey, query(), multiSuiteReport);

    const externalIds = ingested.map((body) => body.externalId);
    expect(new Set(externalIds).size).toBe(3);
    for (const externalId of externalIds) {
      expect(externalId).toMatch(/^ci-42-[a-z0-9-]+-[0-9a-f]{8}$/);
    }
  });

  it('returns one run per suite group, in the same order', async () => {
    const { controller } = build();

    const result = await controller.ingestJunit(
      apiKey,
      query(),
      multiSuiteReport,
    );

    expect(result.runs).toHaveLength(3);
  });

  it('does not split by suite when the caller pins an explicit suiteId', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(
      apiKey,
      query({ suiteId: 'suite-9' }),
      multiSuiteReport,
    );

    expect(ingested).toHaveLength(1);
    expect(ingested[0].suiteId).toBe('suite-9');
    expect(ingested[0].cases).toHaveLength(3);
  });

  it('does not split by suite when the caller pins an explicit suiteName', async () => {
    const { controller, ingested } = build();

    await controller.ingestJunit(
      apiKey,
      query({ suiteName: 'Pinned Suite' }),
      multiSuiteReport,
    );

    expect(ingested).toHaveLength(1);
    expect(ingested[0].suiteName).toBe('Pinned Suite');
    expect(ingested[0].cases).toHaveLength(3);
  });
});
