import {
  BadRequestException,
  ConflictException,
  type HttpException,
  NotFoundException,
} from '@nestjs/common';
import type { OrgContext } from '../organizations/organizations.contracts';
import { err } from '../../common/result';
import { RunQueriesController } from './run-queries.controller';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'member',
};

function buildController(findOne: jest.Mock) {
  const service = {
    findOne,
    list: jest.fn(),
    suiteMetrics: jest.fn(),
    regressions: jest.fn(),
    createManual: jest.fn(),
    updateCaseStatus: jest.fn(),
  };
  return new RunQueriesController(service as never);
}

describe('RunQueriesController error codes', () => {
  it.each([
    ['not-found', NotFoundException, 'Run not found'],
    ['case-not-found', NotFoundException, 'Case not found in this run'],
    ['suite-not-found', NotFoundException, 'Suite not found for this project'],
    [
      'empty-suite',
      BadRequestException,
      'Cannot start a run from a suite with no cases',
    ],
    [
      'no-manual-cases',
      ConflictException,
      'This suite has no manual cases to run; automated cases are read-only here',
    ],
    [
      'source-not-editable',
      ConflictException,
      'Case statuses in an automated run are recorded by the reporting tool and cannot be edited',
    ],
  ] as const)(
    'maps %s to a matching HttpException carrying a { code, message } body',
    async (code, ExceptionType, message) => {
      const controller = buildController(
        jest.fn().mockResolvedValue(err(code)),
      );

      expect.assertions(2);
      try {
        await controller.findOne(org, 'run-1');
      } catch (error) {
        expect(error).toBeInstanceOf(ExceptionType);
        expect((error as HttpException).getResponse()).toEqual({
          code,
          message,
        });
      }
    },
  );
});
