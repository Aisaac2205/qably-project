import { encodeInboxCursor } from './lib/inbox-cursor';
import {
  documentFilesBodySchema,
  reviewInboxCountsQuerySchema,
  reviewInboxQuerySchema,
} from './review.schemas';

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
});
