import type { OrgContext } from '../organizations/organizations.contracts';
import { SuiteListController } from './suite-list.controller';
import type { ListSuiteSummariesQuery } from './suites.schemas';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

function fakeQueries(pageResult: unknown, tagsResult: unknown = null) {
  return {
    page: jest.fn().mockResolvedValue(pageResult),
    tags: jest.fn().mockResolvedValue(tagsResult),
  };
}

function build(queries: ReturnType<typeof fakeQueries>) {
  return new SuiteListController(queries as never);
}

describe('SuiteListController', () => {
  it('forwards the summaries query to SuiteListQueryService.page and returns its page', async () => {
    const page = { items: [], nextCursor: null };
    const queries = fakeQueries(page);
    const query: ListSuiteSummariesQuery = {
      projectId: 'project-1',
      limit: 50,
      sort: 'recent',
      cursor: undefined,
    };

    const response = await build(queries).summaries(org, query);

    expect(queries.page).toHaveBeenCalledWith(org, query);
    expect(response).toBe(page);
  });

  it('forwards another organization and a filtered, cursored query unchanged', async () => {
    const page = { items: [], nextCursor: 'next' };
    const queries = fakeQueries(page);
    const other: OrgContext = { ...org, organizationId: 'org-2' };
    const query: ListSuiteSummariesQuery = {
      projectId: 'project-9',
      limit: 10,
      sort: 'name',
      search: 'checkout',
      tag: 'api',
      status: 'fail',
      cursor: { sort: 'name', name: 'alpha', id: 'suite-1' },
    };

    const response = await build(queries).summaries(other, query);

    expect(queries.page).toHaveBeenCalledWith(other, query);
    expect(response).toBe(page);
  });

  it('forwards the tags query to SuiteListQueryService.tags and returns its facet', async () => {
    const facet = { items: ['api', 'smoke'] };
    const queries = fakeQueries(null, facet);

    const response = await build(queries).tags(org, {
      projectId: 'project-1',
    });

    expect(queries.tags).toHaveBeenCalledWith(org, { projectId: 'project-1' });
    expect(queries.page).not.toHaveBeenCalled();
    expect(response).toBe(facet);
  });

  it('forwards the tags query of another organization and project unchanged', async () => {
    const facet = { items: [] };
    const queries = fakeQueries(null, facet);
    const other: OrgContext = { ...org, organizationId: 'org-2' };

    const response = await build(queries).tags(other, {
      projectId: 'project-9',
    });

    expect(queries.tags).toHaveBeenCalledWith(other, {
      projectId: 'project-9',
    });
    expect(response).toBe(facet);
  });
});
