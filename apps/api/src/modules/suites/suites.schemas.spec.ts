import type { SuiteSortKey } from '@qably/types';
import { encodeSuiteSummariesCursor } from './lib/suite-summaries-cursor';
import {
  confirmDocumentationSchema,
  createCaseSchema,
  createSuiteSchema,
  listSuiteSummariesQuerySchema,
  listSuitesQuerySchema,
  listSuiteTagsQuerySchema,
  updateCaseSchema,
  updateSuiteSchema,
} from './suites.schemas';

describe('createSuiteSchema', () => {
  it('fills the optional fields the ui does not send', () => {
    expect(
      createSuiteSchema.parse({ projectId: 'project-1', name: '  Checkout  ' }),
    ).toEqual({
      projectId: 'project-1',
      name: 'Checkout',
      description: '',
      tags: [],
      isDefault: false,
    });
  });

  it('requires a project so a suite can never be orphaned', () => {
    expect(createSuiteSchema.safeParse({ name: 'Checkout' }).success).toBe(
      false,
    );
  });
});

describe('updateSuiteSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateSuiteSchema.safeParse({}).success).toBe(false);
  });

  it('accepts promoting a suite to default on its own', () => {
    expect(updateSuiteSchema.parse({ isDefault: true })).toEqual({
      isDefault: true,
    });
  });
});

describe('createCaseSchema', () => {
  it('defaults priority and state to the values the ui shows', () => {
    const parsed = createCaseSchema.parse({ name: 'Adds to cart' });

    expect(parsed.priority).toBe('medium');
    expect(parsed.state).toBe('active');
    expect(parsed.steps).toEqual([]);
    expect(parsed.objective).toBe('');
    expect(parsed.preconditions).toEqual([]);
  });

  it('accepts an objective and a list of preconditions', () => {
    const parsed = createCaseSchema.parse({
      name: 'Adds to cart',
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty'],
    });

    expect(parsed.objective).toBe('Verify the cart accepts a new item');
    expect(parsed.preconditions).toEqual(['The cart is empty']);
  });

  it('rejects a step that is only whitespace', () => {
    expect(
      createCaseSchema.safeParse({ name: 'Adds to cart', steps: ['  '] })
        .success,
    ).toBe(false);
  });

  it('rejects an unknown priority', () => {
    expect(
      createCaseSchema.safeParse({ name: 'Adds to cart', priority: 'urgent' })
        .success,
    ).toBe(false);
  });
});

describe('confirmDocumentationSchema', () => {
  it('defaults to no case filter when no body is sent', () => {
    expect(confirmDocumentationSchema.parse(undefined)).toEqual({});
  });

  it('accepts an explicit list of case ids', () => {
    expect(
      confirmDocumentationSchema.parse({ caseIds: ['case-1', 'case-2'] }),
    ).toEqual({ caseIds: ['case-1', 'case-2'] });
  });

  it('rejects an explicit empty array instead of silently confirming everything', () => {
    expect(confirmDocumentationSchema.safeParse({ caseIds: [] }).success).toBe(
      false,
    );
  });

  it('rejects more than 500 case ids', () => {
    const caseIds = Array.from({ length: 501 }, (_, i) => `case-${i}`);
    expect(confirmDocumentationSchema.safeParse({ caseIds }).success).toBe(
      false,
    );
  });
});

describe('updateCaseSchema', () => {
  it('rejects an empty patch', () => {
    expect(updateCaseSchema.safeParse({}).success).toBe(false);
  });

  it('strips execution mode and automation fields the client should never set', () => {
    const parsed = updateCaseSchema.parse({
      name: 'Renamed',
      executionMode: 'automated',
      automationKey: 'raw name',
      automationClassName: 'CheckoutSpec',
      automationFilePath: 'e2e/checkout.spec.ts',
    });

    expect(parsed).toEqual({ name: 'Renamed' });
  });

  it('accepts an objective and preconditions patch', () => {
    const parsed = updateCaseSchema.parse({
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty'],
    });

    expect(parsed).toEqual({
      objective: 'Verify the cart accepts a new item',
      preconditions: ['The cart is empty'],
    });
  });
});

describe('listSuitesQuerySchema', () => {
  it('keeps the project optional so the whole organization can be listed', () => {
    expect(listSuitesQuerySchema.parse({})).toEqual({});
  });

  it('rejects an empty project id', () => {
    expect(listSuitesQuerySchema.safeParse({ projectId: '' }).success).toBe(
      false,
    );
  });

  it('ignores the paging parameters of the summaries endpoint', () => {
    expect(
      listSuitesQuerySchema.parse({
        projectId: 'project-1',
        limit: '1',
        cursor: 'x',
      }),
    ).toEqual({ projectId: 'project-1' });
  });
});

describe('listSuiteSummariesQuerySchema', () => {
  const createdAt = '2026-09-24T10:00:00.123Z';
  const recentKey: SuiteSortKey = {
    sort: 'recent',
    createdAt,
    id: 'suite-1',
  };
  const nameKey: SuiteSortKey = {
    sort: 'name',
    name: 'Checkout',
    id: 'suite-1',
  };

  function parse(query: Record<string, unknown>) {
    return listSuiteSummariesQuerySchema.parse({
      projectId: 'project-1',
      ...query,
    });
  }

  function failures(query: Record<string, unknown>): string[] {
    const result = listSuiteSummariesQuerySchema.safeParse({
      projectId: 'project-1',
      ...query,
    });

    return result.success
      ? []
      : result.error.issues.map((issue) => issue.path.join('.'));
  }

  it('applies the default limit and the recent sort', () => {
    expect(parse({})).toEqual({
      projectId: 'project-1',
      limit: 50,
      sort: 'recent',
    });
  });

  it('requires a non-empty project id', () => {
    expect(listSuiteSummariesQuerySchema.safeParse({}).success).toBe(false);
    expect(
      listSuiteSummariesQuerySchema.safeParse({ projectId: '' }).success,
    ).toBe(false);
  });

  it.each(['0', '101', '1.5', 'abc', '-3', ''])(
    'rejects the limit %p',
    (limit) => {
      expect(failures({ limit })).toEqual(['limit']);
    },
  );

  it.each([
    ['1', 1],
    ['50', 50],
    ['100', 100],
  ])('coerces the limit %p to the number %p', (limit, expected) => {
    expect(parse({ limit }).limit).toBe(expected);
  });

  it.each(['oldest', 'Recent', ''])('rejects the sort %p', (sort) => {
    expect(failures({ sort })).toEqual(['sort']);
  });

  it.each(['recent', 'name', 'pass-rate', 'cases'])(
    'accepts the sort %p',
    (sort) => {
      expect(parse({ sort }).sort).toBe(sort);
    },
  );

  it.each(['all', 'done', 'PASS', ''])('rejects the status %p', (status) => {
    expect(failures({ status })).toEqual(['status']);
  });

  it.each(['running', 'pass', 'fail', 'needs-attention', 'never-run'])(
    'accepts the status %p',
    (status) => {
      expect(parse({ status }).status).toBe(status);
    },
  );

  it('trims the search before it reaches the service', () => {
    expect(parse({ search: '  Checkout  ' }).search).toBe('Checkout');
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['201 characters', 'a'.repeat(201)],
  ])('rejects a search that is %s', (_label, search) => {
    expect(failures({ search })).toEqual(['search']);
  });

  it('accepts a search of exactly 200 characters', () => {
    expect(parse({ search: 'a'.repeat(200) }).search).toBe('a'.repeat(200));
  });

  it('keeps the tag exactly as sent because membership is case sensitive', () => {
    expect(parse({ tag: ' API ' }).tag).toBe(' API ');
  });

  it.each([
    ['empty', ''],
    ['41 characters', 'a'.repeat(41)],
  ])('rejects a tag that is %s', (_label, tag) => {
    expect(failures({ tag })).toEqual(['tag']);
  });

  it('accepts a tag of exactly 40 characters', () => {
    expect(parse({ tag: 'a'.repeat(40) }).tag).toBe('a'.repeat(40));
  });

  it('leaves the cursor undefined when none is sent', () => {
    expect(parse({}).cursor).toBeUndefined();
  });

  it('decodes the cursor once into the sort key', () => {
    expect(
      parse({ cursor: encodeSuiteSummariesCursor(recentKey) }).cursor,
    ).toEqual(recentKey);
  });

  it('decodes a cursor against the sort that was requested', () => {
    const parsed = parse({
      sort: 'name',
      cursor: encodeSuiteSummariesCursor(nameKey),
    });

    expect(parsed.cursor).toEqual(nameKey);
  });

  it('reports a cursor of another sort as an issue on cursor', () => {
    expect(failures({ cursor: encodeSuiteSummariesCursor(nameKey) })).toEqual([
      'cursor',
    ]);
    expect(
      failures({ sort: 'name', cursor: encodeSuiteSummariesCursor(recentKey) }),
    ).toEqual(['cursor']);
  });

  it('applies the default sort when matching the cursor', () => {
    expect(
      failures({
        sort: 'cases',
        cursor: encodeSuiteSummariesCursor(recentKey),
      }),
    ).toEqual(['cursor']);
    expect(parse({ cursor: encodeSuiteSummariesCursor(recentKey) }).sort).toBe(
      'recent',
    );
  });

  it('reports a malformed cursor as an issue on cursor', () => {
    expect(failures({ cursor: 'not-a-cursor' })).toEqual(['cursor']);
  });

  it('reports an empty cursor as an issue on cursor', () => {
    expect(failures({ cursor: '' })).toEqual(['cursor']);
  });

  it('reports a cursor longer than 2048 characters even when it decodes', () => {
    const oversized = encodeSuiteSummariesCursor({
      sort: 'name',
      name: 'n'.repeat(2000),
      id: 'suite-1',
    });

    expect(oversized.length).toBeGreaterThan(2048);
    expect(failures({ sort: 'name', cursor: oversized })).toEqual(['cursor']);
  });

  it('carries every filter and the decoded cursor together', () => {
    expect(
      parse({
        limit: '25',
        sort: 'recent',
        search: ' auth ',
        tag: 'api',
        status: 'fail',
        cursor: encodeSuiteSummariesCursor(recentKey),
      }),
    ).toEqual({
      projectId: 'project-1',
      limit: 25,
      sort: 'recent',
      search: 'auth',
      tag: 'api',
      status: 'fail',
      cursor: recentKey,
    });
  });
});

describe('listSuiteTagsQuerySchema', () => {
  it('requires a non-empty project id', () => {
    expect(listSuiteTagsQuerySchema.safeParse({}).success).toBe(false);
    expect(listSuiteTagsQuerySchema.safeParse({ projectId: '' }).success).toBe(
      false,
    );
  });

  it('reads the project id and nothing else', () => {
    expect(
      listSuiteTagsQuerySchema.parse({
        projectId: 'project-1',
        search: 'auth',
        status: 'fail',
        tag: 'api',
        cursor: 'x',
        limit: '5',
      }),
    ).toEqual({ projectId: 'project-1' });
  });
});
