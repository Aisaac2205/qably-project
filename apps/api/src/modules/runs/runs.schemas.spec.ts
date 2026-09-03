import {
  createManualRunSchema,
  ingestJunitQuerySchema,
  ingestRunSchema,
  listRunsQuerySchema,
  updateRunCaseStatusSchema,
} from './runs.schemas';

const baseCase = {
  name: 'Adds to cart',
  status: 'pass' as const,
};

const baseInput = {
  externalId: 'ci-run-42',
  suiteId: 'suite-1',
  name: 'Checkout regression',
  cases: [baseCase],
};

const baseInputWithoutSuiteId = {
  externalId: 'ci-run-42',
  name: 'Checkout regression',
  cases: [baseCase],
};

describe('ingestRunSchema', () => {
  it('accepts a minimal valid payload and defaults source to api', () => {
    const result = ingestRunSchema.safeParse(baseInput);

    expect(result.success).toBe(true);
    expect(result.success && result.data.source).toBe('api');
  });

  it('rejects an empty externalId', () => {
    const result = ingestRunSchema.safeParse({ ...baseInput, externalId: '' });

    expect(result.success).toBe(false);
  });

  it('rejects source manual', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      source: 'manual',
    });

    expect(result.success).toBe(false);
  });

  it('accepts source github_actions', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      source: 'github_actions',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a payload with neither suiteId nor suiteName', () => {
    const result = ingestRunSchema.safeParse(baseInputWithoutSuiteId);

    expect(result.success).toBe(false);
  });

  it('rejects a payload with both suiteId and suiteName', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      suiteName: 'Checkout',
    });

    expect(result.success).toBe(false);
  });

  it('accepts resolving the suite by name instead of id', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInputWithoutSuiteId,
      suiteName: 'Checkout',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an empty case list', () => {
    const result = ingestRunSchema.safeParse({ ...baseInput, cases: [] });

    expect(result.success).toBe(false);
  });

  it('rejects a case without a status', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ name: 'Adds to cart' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a case with an invalid status', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ ...baseCase, status: 'exploded' }],
    });

    expect(result.success).toBe(false);
  });

  it('defaults case steps and expectedResult', () => {
    const result = ingestRunSchema.safeParse(baseInput);

    expect(result.success).toBe(true);
    expect(result.success && result.data.cases[0].steps).toEqual([]);
    expect(result.success && result.data.cases[0].expectedResult).toBe('');
  });

  it('accepts ISO datetime fields', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:05:00.000Z',
      cases: [{ ...baseCase, recordedAt: '2026-01-01T00:01:00.000Z' }],
    });

    expect(result.success).toBe(true);
  });

  it('rejects a non ISO startedAt', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      startedAt: 'yesterday',
    });

    expect(result.success).toBe(false);
  });
});

describe('listRunsQuerySchema', () => {
  it('accepts an empty query', () => {
    const result = listRunsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('accepts a projectId filter', () => {
    const result = listRunsQuerySchema.safeParse({ projectId: 'project-1' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.projectId).toBe('project-1');
  });
});

describe('createManualRunSchema', () => {
  it('accepts a minimal valid payload', () => {
    const result = createManualRunSchema.safeParse({
      projectId: 'project-1',
      suiteId: 'suite-1',
    });

    expect(result.success).toBe(true);
  });

  it('accepts an explicit name', () => {
    const result = createManualRunSchema.safeParse({
      projectId: 'project-1',
      suiteId: 'suite-1',
      name: 'Manual smoke test',
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.name).toBe('Manual smoke test');
  });

  it('rejects a payload without a suiteId', () => {
    const result = createManualRunSchema.safeParse({ projectId: 'project-1' });

    expect(result.success).toBe(false);
  });

  it('rejects a payload without a projectId', () => {
    const result = createManualRunSchema.safeParse({ suiteId: 'suite-1' });

    expect(result.success).toBe(false);
  });
});

describe('updateRunCaseStatusSchema', () => {
  it.each(['pass', 'fail', 'skip', 'blocked'])(
    'accepts status %s',
    (status) => {
      const result = updateRunCaseStatusSchema.safeParse({ status });

      expect(result.success).toBe(true);
    },
  );

  it.each(['pending', 'running'])(
    'rejects status %s because it cannot be set through this endpoint',
    (status) => {
      const result = updateRunCaseStatusSchema.safeParse({ status });

      expect(result.success).toBe(false);
    },
  );

  it('rejects a missing status', () => {
    const result = updateRunCaseStatusSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe('ingestJunitQuerySchema', () => {
  it('accepts a minimal query and defaults source to api', () => {
    const result = ingestJunitQuerySchema.safeParse({ externalId: 'ci-42' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.source).toBe('api');
  });

  it('rejects a missing externalId', () => {
    expect(ingestJunitQuerySchema.safeParse({}).success).toBe(false);
  });

  it('rejects a source the api key may not use', () => {
    const result = ingestJunitQuerySchema.safeParse({
      externalId: 'ci-42',
      source: 'manual',
    });

    expect(result.success).toBe(false);
  });

  it('carries the commit metadata through', () => {
    const result = ingestJunitQuerySchema.safeParse({
      externalId: 'ci-42',
      commitSha: 'a41f9c2',
      commitAuthor: 'ci-bot',
    });

    expect(result.success && result.data.commitSha).toBe('a41f9c2');
    expect(result.success && result.data.commitAuthor).toBe('ci-bot');
  });
});
