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
import { Throttle } from '@nestjs/throttler';
import { CurrentApiKey } from '../api-keys/decorators/current-api-key.decorator';
import type { ApiKeyIdentity } from '../api-keys/api-keys.contracts';
import { ApiKeyGuard } from '../api-keys/guards/api-key.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { isErr, type Result } from '../../common/result';
import type { JunitIngestView, RunError, RunView } from './runs.contracts';
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

@Controller('runs')
@UseGuards(ApiKeyGuard)
@Public()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

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
  @HttpCode(HttpStatus.OK)
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

    const runs: RunView[] = [];

    for (const group of groups) {
      const body = ingestRunSchema.parse({
        ...query,
        externalId: group.externalId,
        suiteName: query.suiteId
          ? undefined
          : (query.suiteName ?? group.suiteName),
        name: query.name ?? group.suiteName,
        cases: group.cases,
      });

      runs.push(unwrap(await this.runs.ingest(apiKey, body)));
    }

    return { runs };
  }
}
