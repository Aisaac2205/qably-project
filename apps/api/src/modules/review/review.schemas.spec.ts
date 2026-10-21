import { encodeInboxCursor } from './lib/inbox-cursor';
import {
  approveSchema,
  documentFilesBodySchema,
  reviewInboxCountsQuerySchema,
  reviewInboxQuerySchema,
} from './review.schemas';

describe('approveSchema', () => {
  it('leaves applyTo unset when the reviewer chose nothing', () => {
    expect(approveSchema.parse({})).toEqual({});
  });

  it.each(['matched-case', 'new-case'] as const)(
    'accepts applyTo %s',
    (applyTo) => {
      expect(approveSchema.parse({ applyTo }).applyTo).toBe(applyTo);
    },
  );

  it('rejects any other target, including a raw case id', () => {
    expect(() => approveSchema.parse({ applyTo: 'case-1' })).toThrow();
  });

  it('still takes the optional comment', () => {
    expect(approveSchema.parse({ comment: ' Looks right ' })).toEqual({
      comment: 'Looks right',
    });
  });

  it('takes the id of the published version the reviewer saw', () => {
    expect(approveSchema.parse({ baseVersionId: 'version-4' })).toEqual({
      baseVersionId: 'version-4',
    });
  });

  it('takes a null base when the reviewer saw no published version', () => {
    expect(approveSchema.parse({ baseVersionId: null })).toEqual({
      baseVersionId: null,
    });
  });

  it('rejects an empty base version id', () => {
    expect(() => approveSchema.parse({ baseVersionId: '' })).toThrow();
  });
});

describe('documentFilesBodySchema', () => {
  it('defaults to undocumented mode when the body is omitted', () => {
    expect(documentFilesBodySchema.parse(undefined)).toEqual({
      mode: 'undocumented',
    });
  });

  it('accepts stale-locale mode', () => {
    expect(documentFilesBodySchema.parse({ mode: 'stale-locale' })).toEqual({
      mode: 'stale-locale',
    });
  });

  it('accepts incomplete mode', () => {
    expect(documentFilesBodySchema.parse({ mode: 'incomplete' })).toEqual({
      mode: 'incomplete',
    });
  });

  it('rejects an unrecognized mode', () => {
    expect(() => documentFilesBodySchema.parse({ mode: 'bogus' })).toThrow();
  });
});

describe('reviewInboxQuerySchema', () => {
  it('defaults status to in_review and limit to 50', () => {
    expect(reviewInboxQuerySchema.parse({})).toEqual({
      status: 'in_review',
      limit: 50,
    });
  });

  it('caps limit at 100', () => {
    expect(() => reviewInboxQuerySchema.parse({ limit: '101' })).toThrow();
  });

  it('accepts a well-formed cursor', () => {
    const cursor = encodeInboxCursor({
      createdAt: '2026-09-24T10:00:00.000Z',
      id: 'proposal-1',
    });

    expect(reviewInboxQuerySchema.parse({ cursor }).cursor).toBe(cursor);
  });

  it('rejects a malformed cursor', () => {
    expect(() =>
      reviewInboxQuerySchema.parse({ cursor: 'not-a-cursor' }),
    ).toThrow();
  });

  it('accepts status "all" to request every status', () => {
    expect(reviewInboxQuerySchema.parse({ status: 'all' }).status).toBe('all');
  });

  it('accepts a batch id and keeps it with the other filters', () => {
    expect(
      reviewInboxQuerySchema.parse({
        projectId: 'project-1',
        batch: 'batch-1',
      }),
    ).toMatchObject({ projectId: 'project-1', batch: 'batch-1' });
  });

  it('trims the batch id', () => {
    expect(reviewInboxQuerySchema.parse({ batch: ' batch-1 ' }).batch).toBe(
      'batch-1',
    );
  });

  it('leaves the batch unset when the query does not name one', () => {
    expect(reviewInboxQuerySchema.parse({})).not.toHaveProperty('batch');
  });

  it.each(['', '   '])('rejects the blank batch id %j', (batch) => {
    expect(() => reviewInboxQuerySchema.parse({ batch })).toThrow();
  });

  it('rejects a batch id longer than any id the API issues', () => {
    expect(() =>
      reviewInboxQuerySchema.parse({ batch: 'a'.repeat(65) }),
    ).toThrow();
  });
});

describe('reviewInboxCountsQuerySchema', () => {
  it('accepts an empty query', () => {
    expect(reviewInboxCountsQuerySchema.parse({})).toEqual({});
  });

  it('accepts projectId and search', () => {
    expect(
      reviewInboxCountsQuerySchema.parse({
        projectId: 'project-1',
        search: 'cart',
      }),
    ).toEqual({ projectId: 'project-1', search: 'cart' });
  });

  it('accepts a batch id, so the status tabs can count the same batch the list shows', () => {
    expect(reviewInboxCountsQuerySchema.parse({ batch: ' batch-1 ' })).toEqual({
      batch: 'batch-1',
    });
  });

  it('rejects a blank batch id', () => {
    expect(() => reviewInboxCountsQuerySchema.parse({ batch: '' })).toThrow();
  });
});
