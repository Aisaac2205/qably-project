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
  const rejected = params.results.filter(
    (result) => result.status === 'rejected',
  );
  const hasIssues = failed.length > 0 || rejected.length > 0;
  const eventType = hasIssues ? 'run_failed' : 'run_completed';

  const payload: Record<string, string | number> = {
    count: params.results.length,
  };

  if (failed.length > 0) {
    payload.failedCount = failed.length;
    payload.failedSuiteNames = failed
      .map((result) => result.suiteName)
      .join(', ');
  }

  if (rejected.length > 0) {
    payload.rejectedCount = rejected.length;
    payload.rejectedSuiteNames = rejected
      .map((result) => result.suiteName)
      .join(', ');
  }

  return {
    eventType,
    organizationId: params.organizationId,
    severity: hasIssues ? 'high' : 'low',
    payload,
    dedupeKey: `${eventType}:report:${params.reportExternalId}`,
    projectId: params.projectId,
  };
}
