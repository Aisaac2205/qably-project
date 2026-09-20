import type { NotificationJobData } from '../../notifications/notifications.contracts';
import type { BatchSuiteResult } from './report-batch.types';

export interface BuildBatchNotificationParams {
  organizationId: string;
  projectId: string;
  reportExternalId: string;
  results: readonly BatchSuiteResult[];
}

export function buildBatchNotificationEvent(
  params: BuildBatchNotificationParams,
): NotificationJobData {
  const failed = params.results.filter((result) => result.status === 'fail');
  const isFailed = failed.length > 0;
  const eventType = isFailed ? 'run_failed' : 'run_completed';

  const payload: Record<string, string | number> = isFailed
    ? {
        count: params.results.length,
        failedCount: failed.length,
        failedSuiteNames: failed.map((result) => result.suiteName).join(', '),
      }
    : { count: params.results.length };

  return {
    eventType,
    organizationId: params.organizationId,
    severity: isFailed ? 'high' : 'low',
    payload,
    dedupeKey: `${eventType}:report:${params.reportExternalId}`,
    projectId: params.projectId,
  };
}
