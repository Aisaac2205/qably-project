import { NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.contracts';
import type { OrgContext } from '../organizations/organizations.contracts';
import { ProjectsController } from './projects.controller';

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
  return { enqueueDocumentFiles: jest.fn().mockResolvedValue(result) };
}

function build(extraction: ReturnType<typeof fakeExtraction>) {
  return new ProjectsController({} as never, extraction as never);
}

describe('ProjectsController.documentProject', () => {
  it("enqueues file-level documentation scoped to the project with the acting user's locale", async () => {
    const extraction = fakeExtraction({
      ok: true,
      value: { filesEnqueued: 4, casesTargeted: 9, casesSkipped: [] },
    });

    const result = await build(extraction).documentProject(
      org,
      'project-1',
      user,
      { mode: 'undocumented' },
    );

    expect(result).toEqual({
      filesEnqueued: 4,
      casesTargeted: 9,
      casesSkipped: [],
    });
    expect(extraction.enqueueDocumentFiles).toHaveBeenCalledWith(
      org,
      { projectId: 'project-1' },
      'es',
      'undocumented',
    );
  });

  it('throws a coded NotFoundException when the project does not exist', async () => {
    const extraction = fakeExtraction({ ok: false, error: 'not-found' });

    await expect(
      build(extraction).documentProject(org, 'project-1', user, {
        mode: 'undocumented',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      build(extraction).documentProject(org, 'project-1', user, {
        mode: 'undocumented',
      }),
    ).rejects.toMatchObject({ response: { code: 'not-found' } });
  });
});
