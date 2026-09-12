import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { buildJobId } from '../../common/queue/job-id';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { OrgContext } from '../organizations/organizations.contracts';
import { SuitesController } from './suites.controller';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

const user: AuthenticatedUser = {
  id: 'user-1',
  email: 'qa@acme.test',
  name: 'QA',
  emailVerified: true,
  locale: 'es',
};

function fakeExtraction(result: unknown) {
  return {
    enqueueDocumentCase: jest.fn().mockResolvedValue(result),
    enqueueDocumentFiles: jest.fn().mockResolvedValue(result),
  };
}

function fakeSuites(result?: unknown) {
  return {
    confirmDocumentation: jest.fn().mockResolvedValue(result),
  };
}

function build(
  extraction: ReturnType<typeof fakeExtraction>,
  suites: ReturnType<typeof fakeSuites> = fakeSuites(),
) {
  return new SuitesController(suites as never, extraction as never);
}

describe('SuitesController.documentCase', () => {
  it("queues the extraction with the acting user's locale and returns the jobId", async () => {
    const jobId = buildJobId('document-case', ['case-1']);
    const extraction = fakeExtraction({
      ok: true,
      value: { jobId },
    });

    const result = await build(extraction).documentCase(
      org,
      'suite-1',
      'case-1',
      user,
    );

    expect(result).toEqual({ queued: true, jobId });
    expect(extraction.enqueueDocumentCase).toHaveBeenCalledWith(
      org,
      'suite-1',
      'case-1',
      'es',
    );
  });

  it('throws a coded NotFoundException when the case does not exist', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'not-found' });

    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1', user),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1', user),
    ).rejects.toMatchObject({ response: { code: 'not-found' } });
  });

  it('throws a coded ConflictException when the case is not automated', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'not-automated' });

    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1', user),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1', user),
    ).rejects.toMatchObject({ response: { code: 'not-automated' } });
  });

  it('throws a coded ConflictException when no repository file matches the case', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'no-source-file' });

    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1', user),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1', user),
    ).rejects.toMatchObject({ response: { code: 'no-source-file' } });
  });

  it('throws a coded ConflictException when a proposal is already pending', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'already-pending' });

    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1', user),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1', user),
    ).rejects.toMatchObject({ response: { code: 'already-pending' } });
  });
});

describe('SuitesController.documentSuite', () => {
  it('enqueues file-level documentation scoped to the suite and returns the counts', async () => {
    const extraction = fakeExtraction({
      ok: true,
      value: { filesEnqueued: 3, casesTargeted: 5, casesSkipped: [] },
    });

    const result = await build(extraction).documentSuite(org, 'suite-1', user, {
      mode: 'undocumented',
    });

    expect(result).toEqual({
      filesEnqueued: 3,
      casesTargeted: 5,
      casesSkipped: [],
    });
    expect(extraction.enqueueDocumentFiles).toHaveBeenCalledWith(
      org,
      { suiteId: 'suite-1' },
      'es',
      'undocumented',
    );
  });

  it('throws a coded NotFoundException when the suite does not exist', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'not-found' });

    await expect(
      build(extraction).documentSuite(org, 'suite-1', user, {
        mode: 'undocumented',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SuitesController.confirmDocumentation', () => {
  it("confirms the suite's documented draft cases and returns the report", async () => {
    const report = {
      suiteId: 'suite-1',
      confirmedCaseIds: ['case-1'],
      confirmedCount: 1,
      skippedCaseIds: [],
      skippedCount: 0,
      documentationConfirmedAt: '2026-09-12T00:00:00.000Z',
      documentationConfirmedById: 'user-1',
    };
    const suites = fakeSuites({ ok: true, value: report });

    const result = await build(
      fakeExtraction(null),
      suites,
    ).confirmDocumentation(org, 'suite-1', user);

    expect(result).toEqual(report);
    expect(suites.confirmDocumentation).toHaveBeenCalledWith(
      org,
      'suite-1',
      user.id,
    );
  });

  it('throws a coded NotFoundException when the suite does not exist', async () => {
    const suites = fakeSuites({ ok: false, error: 'not-found' });

    await expect(
      build(fakeExtraction(null), suites).confirmDocumentation(
        org,
        'suite-1',
        user,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws a ForbiddenException when the caller cannot write to the suite', async () => {
    const suites = fakeSuites({ ok: false, error: 'forbidden' });

    await expect(
      build(fakeExtraction(null), suites).confirmDocumentation(
        org,
        'suite-1',
        user,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
