import { Injectable } from '@nestjs/common';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { isUniqueViolation } from '../../prisma/is-unique-violation';
import { PrismaService } from '../../prisma/prisma.service';
import { parseCiRunExternalId, resolveCiJobKey } from './lib/ci-external-id';
import type { IngestRunInput } from './runs.schemas';

const KNOWN_JOB_KEY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export interface CiRunLink {
  ciRunId: string;
  ciJobKey?: string;
}

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
  ): Promise<CiRunLink | undefined> {
    if (input.ciRunExternalId !== undefined) {
      return this.link(apiKey, input, input.ciRunExternalId, input.ciJobKey);
    }

    const ciRunExternalId = parseCiRunExternalId(input.externalId);
    if (ciRunExternalId === undefined) return undefined;

    const ciJobKey =
      input.ciJobKey ??
      (await this.resolveJobKey(apiKey, input.externalId, ciRunExternalId));

    return this.link(apiKey, input, ciRunExternalId, ciJobKey);
  }

  private async resolveJobKey(
    apiKey: ApiKeyIdentity,
    externalId: string,
    ciRunExternalId: string,
  ): Promise<string | undefined> {
    const since = new Date(Date.now() - KNOWN_JOB_KEY_WINDOW_MS);
    const rows = await this.prisma.run.groupBy({
      by: ['ciJobKey'],
      where: {
        projectId: apiKey.projectId,
        ciJobKey: { not: null },
        startedAt: { gte: since },
      },
    });
    const knownJobKeys = rows.flatMap((row) =>
      row.ciJobKey === null ? [] : [row.ciJobKey],
    );

    return resolveCiJobKey(externalId, ciRunExternalId, knownJobKeys);
  }

  private async link(
    apiKey: ApiKeyIdentity,
    input: IngestRunInput,
    ciRunExternalId: string,
    ciJobKey: string | undefined,
  ): Promise<CiRunLink> {
    const ciRunId = await this.upsertCiRun(apiKey, input, ciRunExternalId);

    return ciJobKey === undefined ? { ciRunId } : { ciRunId, ciJobKey };
  }

  private async upsertCiRun(
    apiKey: ApiKeyIdentity,
    input: IngestRunInput,
    ciRunExternalId: string,
  ): Promise<string> {
    const now = new Date();
    const where = {
      projectId_source_externalId: {
        projectId: apiKey.projectId,
        source: input.source,
        externalId: ciRunExternalId,
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
          externalId: ciRunExternalId,
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
