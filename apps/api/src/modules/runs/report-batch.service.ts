import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { buildJobId } from '../../common/queue/job-id';
import { NotificationsPublisher } from '../notifications/notifications.publisher';
import { buildBatchNotificationEvent } from './lib/build-batch-notification';
import {
  buildReportBatchKey,
  type BatchSuiteResult,
} from './lib/report-batch.types';
import {
  REPORT_BATCH_TIMEOUT_DELAY_MS,
  REPORT_BATCH_TIMEOUT_JOB,
  RUN_INGEST_QUEUE,
  type ReportBatchTimeoutJobData,
  type RunQueueJobData,
} from './runs.contracts';
import { REPORT_BATCH_REDIS } from './report-batch.tokens';

const RESULT_FIELD_PREFIX = 'result:';

interface RecordSuiteResultResult {
  complete: boolean;
  created: number;
  data?: Record<string, string>;
}

interface FlushBatchResult {
  found: boolean;
  data?: Record<string, string>;
}

export interface ReportBatchRedisClient {
  recordReportSuiteResult(
    key: string,
    size: string,
    organizationId: string,
    projectId: string,
    reportExternalId: string,
    field: string,
    value: string,
  ): Promise<string>;
  flushReportBatch(key: string): Promise<string>;
  quit(): Promise<unknown>;
}

export interface RecordSuiteResultParams {
  organizationId: string;
  projectId: string;
  source: string;
  reportExternalId: string;
  reportSize: number;
  runId: string;
  suiteName: string;
  status: 'pass' | 'fail';
}

function extractResults(raw: Record<string, string>): BatchSuiteResult[] {
  return Object.entries(raw)
    .filter(([field]) => field.startsWith(RESULT_FIELD_PREFIX))
    .map(([, value]) => JSON.parse(value) as BatchSuiteResult);
}

@Injectable()
export class ReportBatchService implements OnModuleDestroy {
  private readonly logger = new Logger(ReportBatchService.name);

  constructor(
    @Inject(REPORT_BATCH_REDIS) private readonly redis: ReportBatchRedisClient,
    @InjectQueue(RUN_INGEST_QUEUE)
    private readonly queue: Queue<RunQueueJobData>,
    private readonly notifications: NotificationsPublisher,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async recordAndMaybePublish(params: RecordSuiteResultParams): Promise<void> {
    const key = buildReportBatchKey(params);
    const raw = await this.redis.recordReportSuiteResult(
      key,
      String(params.reportSize),
      params.organizationId,
      params.projectId,
      params.reportExternalId,
      `${RESULT_FIELD_PREFIX}${params.runId}`,
      JSON.stringify({
        suiteName: params.suiteName,
        status: params.status,
      } satisfies BatchSuiteResult),
    );
    const result = JSON.parse(raw) as RecordSuiteResultResult;

    if (result.created === 1) {
      await this.queue.add(
        REPORT_BATCH_TIMEOUT_JOB,
        { key } satisfies ReportBatchTimeoutJobData,
        {
          delay: REPORT_BATCH_TIMEOUT_DELAY_MS,
          jobId: buildJobId(REPORT_BATCH_TIMEOUT_JOB, [key]),
        },
      );
    }

    if (!result.complete || result.data === undefined) return;

    await this.notifications.publish(
      buildBatchNotificationEvent({
        organizationId: result.data.organizationId ?? params.organizationId,
        projectId: result.data.projectId ?? params.projectId,
        reportExternalId:
          result.data.reportExternalId ?? params.reportExternalId,
        results: extractResults(result.data),
      }),
    );
  }

  async flushIfPending(key: string): Promise<void> {
    const raw = await this.redis.flushReportBatch(key);
    const result = JSON.parse(raw) as FlushBatchResult;

    if (!result.found || result.data === undefined) return;

    const results = extractResults(result.data);

    if (results.length === 0) return;

    this.logger.warn(
      `report batch timed out at ${key} with ${results.length} of ${
        result.data.size ?? results.length
      } suites reported; publishing partial results`,
    );

    await this.notifications.publish(
      buildBatchNotificationEvent({
        organizationId: result.data.organizationId ?? '',
        projectId: result.data.projectId ?? '',
        reportExternalId: result.data.reportExternalId ?? '',
        results,
      }),
    );
  }
}
