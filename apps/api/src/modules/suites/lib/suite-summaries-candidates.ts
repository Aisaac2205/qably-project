import type { SuiteSummary } from '@qably/types';

export type SuiteSummaryBase = Omit<SuiteSummary, 'status' | 'recentPassRate'>;

export interface SuiteSummaryRow {
  id: string;
  projectId: string;
  name: string;
  description: string;
  tags: string[];
  isDefault: boolean;
  createdAt: Date;
  _count: { cases: number };
}

export function toSummaryBase(row: SuiteSummaryRow): SuiteSummaryBase {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    description: row.description,
    tags: row.tags,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    caseCount: row._count.cases,
  };
}
