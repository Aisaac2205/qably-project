import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Throttle } from '@nestjs/throttler';
import type { Queue } from 'bullmq';
import { CurrentApiKey } from '../api-keys/decorators/current-api-key.decorator';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { buildJobId } from '../../common/queue/job-id';
import { isErr, type Result } from '../../common/result';
import type { JunitIngestView, RunError, RunView } from './runs.contracts';
import { RUN_INGEST_QUEUE, type RunIngestJobData } from './runs.contracts';
import {
  ingestJunitQuerySchema,
  ingestRunSchema,
  type IngestJunitQuery,
  type IngestRunInput,
} from './runs.schemas';
import { parseJunitXml } from './lib/parse-junit-xml';
import {
  groupJunitReportBySuite,
  type JunitSuiteGroup,
} from './lib/group-junit-report';
import { findCaseIdentityCollisions } from './lib/case-identity';
import { RunsService } from './runs.service';

function parseJunitReport(xml: string) {
  try {
    return parseJunitXml(xml);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'invalid junit xml',
    );
  }
}

function groupBySuite(
  report: ReturnType<typeof parseJunitXml>,
  externalId: string,
): JunitSuiteGroup[] {
  try {
    return groupJunitReportBySuite(report, externalId);
  } catch (error) {
    throw new BadRequestException(
      error instanceof Error ? error.message : 'invalid junit report',
    );
  }
}

function unwrap<T>(result: Result<T, RunError>): T {
  if (!isErr(result)) return result.value;

  switch (result.error) {
    case 'suite-not-found':
      throw new NotFoundException('Suite not found for this project');
    case 'source-not-allowed':
      throw new BadRequestException(
        'source must be api or github_actions for api key ingestion',
      );
  }
}

const MAX_REPORT_SIZE = 100_000;

function resolveReportSize(
  requestedReportSize: number | undefined,
  acceptedGroupsInRequest: number,
  rejectedGroupsInRequest: number,
): number {
  if (requestedReportSize === undefined) return acceptedGroupsInRequest;
  return Math.min(
    Math.max(
      requestedReportSize - rejectedGroupsInRequest,
      acceptedGroupsInRequest,
    ),
    MAX_REPORT_SIZE,
  );
}

function resolveRunName(
  query: IngestJunitQuery,
  group: JunitSuiteGroup,
): string {
  if (query.name !== undefined) return query.name;
  return group.suiteName !== '' ? group.suiteName : query.externalId;
}

function rejectedSuiteLabel(group: JunitSuiteGroup): string {
  return group.suiteName !== '' ? group.suiteName : group.externalId;
}

type GroupValidation =
  | { ok: true; group: JunitSuiteGroup; body: IngestRunInput }
  | { ok: false; suiteName: string; reason: string };

function validateGroup(
  query: IngestJunitQuery,
  group: JunitSuiteGroup,
): GroupValidation {
  const candidate = {
    ...query,
    externalId: group.externalId,
    reportExternalId: query.externalId,
    suiteName: query.suiteId ? undefined : (query.suiteName ?? group.suiteName),
    name: resolveRunName(query, group),
    cases: group.cases,
  };

  const result = ingestRunSchema.safeParse(candidate);

  if (!result.success) {
    const reason = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');

    return { ok: false, suiteName: rejectedSuiteLabel(group), reason };
  }

  return { ok: true, group, body: result.data };
}

@Controller('runs')
@UseGuards(ApiKeyGuard)
@Public()
export class RunsController {
  constructor(
    private readonly runs: RunsService,
    @InjectQueue(RUN_INGEST_QUEUE)
    private readonly runIngestQueue: Queue<RunIngestJobData>,
  ) {}

  @Post('ingest')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async ingest(
    @CurrentApiKey() apiKey: ApiKeyIdentity,
    @Body(new ZodValidationPipe(ingestRunSchema)) body: IngestRunInput,
  ): Promise<RunView> {
    return unwrap(await this.runs.ingest(apiKey, body));
  }

  @Post('ingest/junit')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestJunit(
    @CurrentApiKey() apiKey: ApiKeyIdentity,
    @Query(new ZodValidationPipe(ingestJunitQuerySchema))
    query: IngestJunitQuery,
    @Body() xml: unknown,
  ): Promise<JunitIngestView> {
    if (typeof xml !== 'string' || xml.trim() === '') {
      throw new BadRequestException('send the JUnit report as an XML body');
    }

    const report = parseJunitReport(xml);
    const suitePinned =
      query.suiteId !== undefined || query.suiteName !== undefined;

    const groups: JunitSuiteGroup[] = suitePinned
      ? [
          {
            suiteName: report.suiteName,
            externalId: query.externalId,
            cases: report.cases,
          },
        ]
      : groupBySuite(report, query.externalId);

    const validations = groups.map((group) => validateGroup(query, group));
    const accepted = validations.filter(
      (validation): validation is Extract<GroupValidation, { ok: true }> =>
        validation.ok,
    );
    const rejected = validations
      .filter(
        (validation): validation is Extract<GroupValidation, { ok: false }> =>
          !validation.ok,
      )
      .map(({ suiteName, reason }) => ({ suiteName, reason }));

    const caseIdentityCollisions = groups.flatMap((group) =>
      findCaseIdentityCollisions(group.cases).map((collision) => ({
        suiteName: rejectedSuiteLabel(group),
        ...collision,
      })),
    );

    const reportSize = resolveReportSize(
      query.reportSize,
      accepted.length,
      rejected.length,
    );

    const jobs = accepted.map(({ body, group }) => ({
      name: 'ingest',
      data: {
        apiKey,
        body,
        reportSize,
      } satisfies RunIngestJobData,
      opts: {
        jobId: buildJobId('ingest', [
          apiKey.projectId,
          body.source,
          body.externalId,
        ]),
      },
      suiteName: group.suiteName,
    }));

    if (jobs.length > 0) {
      await this.runIngestQueue.addBulk(
        jobs.map(({ name, data, opts }) => ({ name, data, opts })),
      );
    }

    return {
      accepted: jobs.length,
      runs: jobs.map((job) => ({
        externalId: job.data.body.externalId,
        suiteName: job.suiteName,
        jobId: job.opts.jobId,
      })),
      rejected,
      caseIdentityCollisions,
      truncatedFields: report.truncatedFieldCounts,
    };
  }
}
