import { Injectable } from '@nestjs/common';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import type { IngestRunInput } from './runs.schemas';

function ciRunFields(input: IngestRunInput) {
  return {
    ...(input.ciWorkflowName === undefined
      ? {}
      : { workflowName: input.ciWorkflowName }),
    ...(input.ciRunNumber === undefined
      ? {}
      : { runNumber: input.ciRunNumber }),
    ...(input.ciRunAttempt === undefined
      ? {}
      : { runAttempt: input.ciRunAttempt }),
    ...(input.ciBranch === undefined ? {} : { branch: input.ciBranch }),
    ...(input.ciHeadRef === undefined ? {} : { headRef: input.ciHeadRef }),
    ...(input.ciActor === undefined ? {} : { actor: input.ciActor }),
    ...(input.ciEventName === undefined
      ? {}
      : { eventName: input.ciEventName }),
    ...(input.ciServerUrl === undefined
      ? {}
      : { serverUrl: input.ciServerUrl }),
    ...(input.ciRepository === undefined
      ? {}
      : { repository: input.ciRepository }),
    ...(input.commitSha === undefined ? {} : { commitSha: input.commitSha }),
    ...(input.commitMessage === undefined
      ? {}
      : { commitMessage: input.commitMessage }),
    ...(input.commitAuthor === undefined
      ? {}
      : { commitAuthor: input.commitAuthor }),
  };
}

@Injectable()
export class CiRunLinker {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    apiKey: ApiKeyIdentity,
    input: IngestRunInput,
  ): Promise<string | undefined> {
    if (input.ciRunExternalId === undefined) return undefined;

    const now = new Date();
    const where = {
      projectId_source_externalId: {
        projectId: apiKey.projectId,
        source: input.source,
        externalId: input.ciRunExternalId,
      },
    };
    const fields = ciRunFields(input);
    const update = { ...fields, lastReportedAt: now };

    try {
      const row = await this.prisma.ciRun.upsert({
        where,
        create: {
          projectId: apiKey.projectId,
          organizationId: apiKey.organizationId,
          source: input.source,
          externalId: input.ciRunExternalId,
          ...fields,
          startedAt: now,
          lastReportedAt: now,
        },
        update,
        select: { id: true },
      });

      return row.id;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const row = await this.prisma.ciRun.update({
        where,
        data: update,
        select: { id: true },
      });

      return row.id;
    }
  }
}
