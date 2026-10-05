import {
  createManualRunSchema,
  ingestJunitQuerySchema,
  ingestRunSchema,
  listCiRunsQuerySchema,
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

  it('accepts the optional JUnit result detail fields on a case', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [
        {
          ...baseCase,
          status: 'fail',
          className: 'checkout.spec',
          filePath: 'e2e/checkout.spec.ts',
          durationMs: 500,
          failureType: 'AssertionError',
          failureMessage: 'expected 200',
          failureDetails: 'at checkout.spec.ts:12',
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.cases[0].className).toBe(
      'checkout.spec',
    );
    expect(result.success && result.data.cases[0].durationMs).toBe(500);
    expect(result.success && result.data.cases[0].failureMessage).toBe(
      'expected 200',
    );
  });

  it('accepts a skipReason on a skipped case', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ ...baseCase, status: 'skip', skipReason: 'requires network' }],
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.cases[0].skipReason).toBe(
      'requires network',
    );
  });

  it('rejects a negative durationMs', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ ...baseCase, durationMs: -1 }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a durationMs above the 32-bit integer range', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ ...baseCase, durationMs: 2_147_483_648 }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a non-integer durationMs', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ ...baseCase, durationMs: 12.5 }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a failureMessage over 1000 characters', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ ...baseCase, failureMessage: 'm'.repeat(1001) }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a failureDetails over 4000 characters', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ ...baseCase, failureDetails: 'd'.repeat(4001) }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a skipReason over 500 characters', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInput,
      cases: [{ ...baseCase, skipReason: 'r'.repeat(501) }],
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

  it('leaves reportSize undefined when omitted', () => {
    const result = ingestJunitQuerySchema.safeParse({ externalId: 'ci-42' });

    expect(result.success && result.data.reportSize).toBeUndefined();
  });

  it('coerces a numeric reportSize query string to a number', () => {
    const result = ingestJunitQuerySchema.safeParse({
      externalId: 'ci-42',
      reportSize: '900',
    });

    expect(result.success && result.data.reportSize).toBe(900);
  });

  it('rejects a reportSize that is not a positive integer', () => {
    expect(
      ingestJunitQuerySchema.safeParse({ externalId: 'ci-42', reportSize: '0' })
        .success,
    ).toBe(false);
    expect(
      ingestJunitQuerySchema.safeParse({
        externalId: 'ci-42',
        reportSize: '1.5',
      }).success,
    ).toBe(false);
    expect(
      ingestJunitQuerySchema.safeParse({
        externalId: 'ci-42',
        reportSize: 'not-a-number',
      }).success,
    ).toBe(false);
  });
});

const ciStringFields = [
  'ciRunExternalId',
  'ciJobKey',
  'ciWorkflowName',
  'ciBranch',
  'ciHeadRef',
  'ciActor',
  'ciEventName',
  'ciRepository',
] as const;

const ciIntFields = ['ciRunNumber', 'ciRunAttempt'] as const;

const fullCiQuery = {
  ciRunExternalId: '900',
  ciJobKey: 'test (node 20)',
  ciWorkflowName: 'CI',
  ciRunNumber: '42',
  ciRunAttempt: '2',
  ciBranch: '12/merge',
  ciHeadRef: 'feature/x',
  ciActor: 'ana',
  ciEventName: 'pull_request',
  ciServerUrl: 'https://github.com',
  ciRepository: 'acme/shop',
};

const fullCiBody = {
  ...fullCiQuery,
  ciRunNumber: 42,
  ciRunAttempt: 2,
};

const ciKeysOf = (value: object) =>
  Object.keys(value).filter((key) => key.startsWith('ci'));

const ciServerUrlOrigins = [
  [
    'credentials, path, query and fragment',
    'https://user:pw@github.com/x?token=abc#frag',
    'https://github.com',
  ],
  ['a username only', 'https://token@github.com', 'https://github.com'],
  ['a trailing slash', 'https://github.com/', 'https://github.com'],
  [
    'a query without a path',
    'https://github.com?token=abc',
    'https://github.com',
  ],
  [
    'a fragment without a path',
    'https://github.com#frag',
    'https://github.com',
  ],
  ['an upper case scheme and host', 'HTTPS://GitHub.com', 'https://github.com'],
  [
    'a custom port and a path',
    'https://ghe.example.com:8443/path',
    'https://ghe.example.com:8443',
  ],
  ['the default port', 'https://github.com:443', 'https://github.com'],
  [
    'plain http with a path',
    'http://ghe.internal/a?b=c',
    'http://ghe.internal',
  ],
  ['an origin', 'https://github.com', 'https://github.com'],
] as const;

describe('ingestJunitQuerySchema ci fields', () => {
  const parse = (extra: Record<string, unknown>) =>
    ingestJunitQuerySchema.safeParse({ externalId: 'ci-42', ...extra });

  it('yields no ci keys when none are sent', () => {
    const result = parse({});

    expect(result.success).toBe(true);
    expect(result.success && ciKeysOf(result.data)).toEqual([]);
  });

  it('carries all eleven ci fields through, coercing the counters', () => {
    const result = parse(fullCiQuery);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(
      expect.objectContaining(fullCiBody),
    );
    expect(result.success && ciKeysOf(result.data).sort()).toEqual(
      Object.keys(fullCiBody).sort(),
    );
  });

  it('keeps only the ci fields that were sent', () => {
    const result = parse({ ciRunExternalId: '900', ciJobKey: 'api' });

    expect(result.success && ciKeysOf(result.data).sort()).toEqual([
      'ciJobKey',
      'ciRunExternalId',
    ]);
  });

  it.each(ciStringFields)('trims %s', (field) => {
    const result = parse({ [field]: '  value  ' });

    expect(
      result.success && (result.data as Record<string, unknown>)[field],
    ).toBe('value');
  });

  it.each(ciStringFields)('rejects an empty or blank %s', (field) => {
    expect(parse({ [field]: '' }).success).toBe(false);
    expect(parse({ [field]: '   ' }).success).toBe(false);
  });

  it.each(ciStringFields)(
    'accepts %s at 255 characters and rejects 256',
    (field) => {
      expect(parse({ [field]: 'a'.repeat(255) }).success).toBe(true);
      expect(parse({ [field]: 'a'.repeat(256) }).success).toBe(false);
    },
  );

  it.each(ciIntFields)('coerces a numeric %s query string', (field) => {
    const result = parse({ [field]: '12' });

    expect(
      result.success && (result.data as Record<string, unknown>)[field],
    ).toBe(12);
  });

  it.each(ciIntFields)(
    'rejects %s when it is not a positive integer',
    (field) => {
      for (const value of ['0', '-1', '1.5', 'abc']) {
        expect(parse({ [field]: value }).success).toBe(false);
      }
    },
  );

  it.each(ciIntFields)('bounds %s to the 32-bit integer range', (field) => {
    expect(parse({ [field]: '2147483647' }).success).toBe(true);
    expect(parse({ [field]: '2147483648' }).success).toBe(false);
    expect(parse({ [field]: '99999999999' }).success).toBe(false);
  });

  it('accepts an http or https ciServerUrl', () => {
    expect(parse({ ciServerUrl: 'https://github.com' }).success).toBe(true);
    expect(parse({ ciServerUrl: 'http://ghe.internal' }).success).toBe(true);
  });

  it.each(['javascript:alert(1)', 'ftp://x', 'github.com'])(
    'rejects the ciServerUrl %s',
    (value) => {
      expect(parse({ ciServerUrl: value }).success).toBe(false);
    },
  );

  it('accepts a ciServerUrl of 255 characters and rejects 256', () => {
    const prefix = 'https://github.com/';
    const atLimit = `${prefix}${'a'.repeat(255 - prefix.length)}`;
    const overLimit = `${atLimit}a`;

    expect(atLimit).toHaveLength(255);
    expect(overLimit).toHaveLength(256);
    expect(parse({ ciServerUrl: atLimit }).success).toBe(true);
    expect(parse({ ciServerUrl: overLimit }).success).toBe(false);
  });

  it.each(ciServerUrlOrigins)(
    'normalizes a ciServerUrl with %s to its origin',
    (_label, value, origin) => {
      const result = parse({ ciServerUrl: value });

      expect(result.success && result.data.ciServerUrl).toBe(origin);
    },
  );

  it('keeps the normalized ciServerUrl stable when it is parsed again', () => {
    const first = parse({ ciServerUrl: 'https://u:p@ghe.example.com:8443/x' });
    const again = parse({
      ciServerUrl: first.success ? first.data.ciServerUrl : undefined,
    });

    expect(again.success && again.data.ciServerUrl).toBe(
      'https://ghe.example.com:8443',
    );
  });

  it('leaves ciServerUrl out of the result when it is not sent', () => {
    const result = parse({});

    expect(result.success && 'ciServerUrl' in result.data).toBe(false);
  });
});

describe('ingestRunSchema ci fields', () => {
  const parse = (extra: Record<string, unknown>) =>
    ingestRunSchema.safeParse({ ...baseInput, ...extra });

  it('yields no ci keys when none are sent', () => {
    const result = parse({});

    expect(result.success).toBe(true);
    expect(result.success && ciKeysOf(result.data)).toEqual([]);
  });

  it('carries all eleven ci fields through instead of stripping them', () => {
    const result = parse(fullCiBody);

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual(
      expect.objectContaining(fullCiBody),
    );
  });

  it('accepts the ci fields when the suite is resolved by name', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInputWithoutSuiteId,
      suiteName: 'Checkout',
      ...fullCiBody,
    });

    expect(result.success && result.data.ciRunExternalId).toBe('900');
  });

  it.each(ciStringFields)(
    'rejects an empty %s and one over 255 characters',
    (field) => {
      expect(parse({ [field]: '' }).success).toBe(false);
      expect(parse({ [field]: 'a'.repeat(255) }).success).toBe(true);
      expect(parse({ [field]: 'a'.repeat(256) }).success).toBe(false);
    },
  );

  it.each(ciIntFields)(
    'accepts a positive integer %s from a JSON body',
    (field) => {
      const result = parse({ [field]: 7 });

      expect(
        result.success && (result.data as Record<string, unknown>)[field],
      ).toBe(7);
    },
  );

  it.each(ciIntFields)(
    'rejects %s when it is not a positive integer',
    (field) => {
      for (const value of [0, -1, 1.5, 'abc']) {
        expect(parse({ [field]: value }).success).toBe(false);
      }
    },
  );

  it.each(ciIntFields)('bounds %s to the 32-bit integer range', (field) => {
    expect(parse({ [field]: 2_147_483_647 }).success).toBe(true);
    expect(parse({ [field]: 2_147_483_648 }).success).toBe(false);
    expect(parse({ [field]: 99_999_999_999 }).success).toBe(false);
  });

  it('accepts an http or https ciServerUrl', () => {
    expect(parse({ ciServerUrl: 'https://github.com' }).success).toBe(true);
    expect(parse({ ciServerUrl: 'http://ghe.internal' }).success).toBe(true);
  });

  it.each(['javascript:alert(1)', 'ftp://x', 'github.com'])(
    'rejects the ciServerUrl %s',
    (value) => {
      expect(parse({ ciServerUrl: value }).success).toBe(false);
    },
  );

  it('rejects a ciServerUrl over 255 characters before normalizing it', () => {
    const prefix = 'https://github.com/';
    const overLimit = `${prefix}${'a'.repeat(256 - prefix.length)}`;

    expect(overLimit).toHaveLength(256);
    expect(parse({ ciServerUrl: overLimit }).success).toBe(false);
  });

  it.each(ciServerUrlOrigins)(
    'normalizes a ciServerUrl with %s to its origin',
    (_label, value, origin) => {
      const result = parse({ ciServerUrl: value });

      expect(result.success && result.data.ciServerUrl).toBe(origin);
    },
  );

  it('leaves ciServerUrl out of the result when it is not sent', () => {
    const result = parse({});

    expect(result.success && 'ciServerUrl' in result.data).toBe(false);
  });

  it('still enforces the suiteId or suiteName rule when ci fields are present', () => {
    const result = ingestRunSchema.safeParse({
      ...baseInputWithoutSuiteId,
      ...fullCiBody,
    });

    expect(result.success).toBe(false);
  });
});

describe('listRunsQuerySchema source filter', () => {
  it.each(['manual', 'api', 'github_actions'])(
    'accepts source=%s',
    (source) => {
      const result = listRunsQuerySchema.safeParse({ source });

      expect(result.success && result.data.source).toBe(source);
    },
  );

  it('rejects a source that is not a run source', () => {
    expect(listRunsQuerySchema.safeParse({ source: 'ci' }).success).toBe(false);
  });

  it('ignores the retired ungrouped parameter instead of reading it', () => {
    const result = listRunsQuerySchema.safeParse({
      projectId: 'project-1',
      source: 'manual',
      ungrouped: 'true',
    });

    expect(result.success && result.data).toEqual({
      projectId: 'project-1',
      source: 'manual',
    });
  });
});

describe('listCiRunsQuerySchema', () => {
  it('requires a projectId', () => {
    expect(listCiRunsQuerySchema.safeParse({}).success).toBe(false);
    expect(listCiRunsQuerySchema.safeParse({ projectId: '' }).success).toBe(
      false,
    );
  });

  it('defaults the limit to 25', () => {
    const result = listCiRunsQuerySchema.safeParse({ projectId: 'project-1' });

    expect(result.success && result.data).toEqual({
      projectId: 'project-1',
      limit: 25,
    });
  });

  it('coerces a numeric limit from the query string', () => {
    const result = listCiRunsQuerySchema.safeParse({
      projectId: 'project-1',
      limit: '10',
    });

    expect(result.success && result.data.limit).toBe(10);
  });

  it.each(['1', '100'])('accepts the boundary limit %s', (limit) => {
    const result = listCiRunsQuerySchema.safeParse({
      projectId: 'project-1',
      limit,
    });

    expect(result.success && result.data.limit).toBe(Number(limit));
  });

  it.each(['0', '101', '-1', '1.5', 'abc'])('rejects limit=%s', (limit) => {
    const result = listCiRunsQuerySchema.safeParse({
      projectId: 'project-1',
      limit,
    });

    expect(result.success).toBe(false);
  });

  it('carries an opaque cursor through and rejects an empty one', () => {
    const accepted = listCiRunsQuerySchema.safeParse({
      projectId: 'project-1',
      cursor: 'ci-run-9',
    });

    expect(accepted.success && accepted.data.cursor).toBe('ci-run-9');
    expect(
      listCiRunsQuerySchema.safeParse({ projectId: 'project-1', cursor: '' })
        .success,
    ).toBe(false);
  });
});
