export interface BatchSuiteResult {
  suiteName: string;
  status: 'pass' | 'fail' | 'rejected';
  reason?: string;
}

export interface ReportBatchKeyParts {
  organizationId: string;
  projectId: string;
  source: string;
  reportExternalId: string;
}

export function buildReportBatchKey(parts: ReportBatchKeyParts): string {
  return `report-batch:${parts.organizationId}:${parts.projectId}:${parts.source}:${parts.reportExternalId}`;
}
