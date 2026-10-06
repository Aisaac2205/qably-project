import type { SuiteSummary } from '@qably/types';

export type SuiteSummaryBase = Omit<SuiteSummary, 'status' | 'recentPassRate'>;

export const SUITE_SUMMARY_SELECT = {
  id: true,
  projectId: true,
  name: true,
  description: true,
  tags: true,
  isDefault: true,
  createdAt: true,
} as const;

export interface SuiteSummaryRow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  tags: string[];
  isDefault: boolean;
  createdAt: Date;
}

export function toSummaryBase(
  row: SuiteSummaryRow,
  caseCounts: ReadonlyMap<string, number>,
): SuiteSummaryBase {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    tags: row.tags,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    caseCount: caseCounts.get(row.id) ?? 0,
  };
}
