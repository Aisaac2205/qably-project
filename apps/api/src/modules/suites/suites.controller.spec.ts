import { ConflictException, NotFoundException } from '@nestjs/common';
import type { OrgContext } from '../organizations/organizations.contracts';
import { SuitesController } from './suites.controller';

const org: OrgContext = {
  organizationId: 'org-1',
  slug: 'acme',
  role: 'admin',
};

function fakeExtraction(result: unknown) {
  return { enqueueDocumentCase: jest.fn().mockResolvedValue(result) };
}

function build(extraction: ReturnType<typeof fakeExtraction>) {
  return new SuitesController({} as never, extraction as never);
}

describe('SuitesController.documentCase', () => {
  it('queues the extraction and returns the jobId', async () => {
    const extraction = fakeExtraction({
      ok: true,
      value: { jobId: 'document-case:case-1' },
    });

    const result = await build(extraction).documentCase(
      org,
      'suite-1',
      'case-1',
    );

    expect(result).toEqual({ queued: true, jobId: 'document-case:case-1' });
    expect(extraction.enqueueDocumentCase).toHaveBeenCalledWith(
      org,
      'suite-1',
      'case-1',
    );
  });

  it('throws a coded NotFoundException when the case does not exist', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'not-found' });

    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1'),
    ).rejects.toMatchObject({ response: { code: 'not-found' } });
  });

  it('throws a coded ConflictException when the case is not automated', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'not-automated' });

    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1'),
    ).rejects.toMatchObject({ response: { code: 'not-automated' } });
  });

  it('throws a coded ConflictException when a proposal is already pending', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'already-pending' });

    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      build(extraction).documentCase(org, 'suite-1', 'case-1'),
    ).rejects.toMatchObject({ response: { code: 'already-pending' } });
  });
});
