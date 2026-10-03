import { NotFoundException, type HttpException } from '@nestjs/common';
import type { CiRunDetailRecord, CiRunsPageRecord } from '@qably/types';
import { err, ok } from '../../common/result';
import type { OrgContext } from '../organizations/organizations.contracts';
import { CiRunsController } from './ci-runs.controller';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

function buildController(service: { list?: jest.Mock; get?: jest.Mock }) {
  return new CiRunsController({
    list: jest.fn(),
    get: jest.fn(),
    ...service,
  } as never);
}

describe('CiRunsController', () => {
  it('delegates the list to the service with the organization and the parsed query', async () => {
    const page: CiRunsPageRecord = { items: [], nextCursor: 'ci-run-7' };
    const list = jest.fn().mockResolvedValue(page);
    const query = { projectId: 'project-1', limit: 10, cursor: 'ci-run-9' };

    const result = await buildController({ list }).list(org, query);

    expect(list).toHaveBeenCalledWith(org, query);
    expect(result).toBe(page);
  });

  it('returns the CI run the service found', async () => {
    const detail = { id: 'ci-run-1', runs: [] } as unknown as CiRunDetailRecord;
    const get = jest.fn().mockResolvedValue(ok(detail));

    const result = await buildController({ get }).get(org, 'ci-run-1');

    expect(get).toHaveBeenCalledWith(org, 'ci-run-1');
    expect(result).toBe(detail);
  });

  it('maps not-found to a 404 carrying a { code, message } body', async () => {
    const get = jest.fn().mockResolvedValue(err('not-found'));

    expect.assertions(2);
    try {
      await buildController({ get }).get(org, 'ci-run-1');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as HttpException).getResponse()).toEqual({
        code: 'not-found',
        message: 'CI run not found',
      });
    }
  });
});
