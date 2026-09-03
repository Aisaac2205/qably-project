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
      return Promise.resolve({ value: { id: 'run-1' } as unknown as RunView });
    }),
  };

  return { controller: new RunsController(runs as never), ingested };
}

const query = (extra: Record<string, unknown> = {}) =>
  ingestJunitQuerySchema.parse({ externalId: 'ci-42', ...extra });

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

  it('answers 400, not 500, when the xml is not a junit report', async () => {
    const { controller } = build();

    await expect(
      controller.ingestJunit(apiKey, query(), '<project><target/></project>'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
