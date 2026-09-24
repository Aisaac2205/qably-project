import type { OrgContext } from '../organizations/organizations.contracts';
import { ReviewInboxController } from './review-inbox.controller';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

function fakeQueries(pageResult: unknown, countsResult: unknown) {
  return {
    page: jest.fn().mockResolvedValue(pageResult),
    counts: jest.fn().mockResolvedValue(countsResult),
  };
}

function build(queries: ReturnType<typeof fakeQueries>) {
  return new ReviewInboxController(queries as never);
}

describe('ReviewInboxController', () => {
  it('forwards the page query to ReviewInboxQueryService.page', async () => {
    const page = { items: [], nextCursor: null };
    const queries = fakeQueries(page, null);

    const response = await build(queries).page(org, {
      status: 'in_review',
      limit: 50,
    });

    expect(queries.page).toHaveBeenCalledWith(org, {
      status: 'in_review',
      limit: 50,
    });
    expect(response).toBe(page);
  });

  it('forwards the counts query to ReviewInboxQueryService.counts', async () => {
    const counts = { byStatus: { in_review: 1 }, version: 'abc' };
    const queries = fakeQueries(null, counts);

    const response = await build(queries).counts(org, {});

    expect(queries.counts).toHaveBeenCalledWith(org, {});
    expect(response).toBe(counts);
  });
});
