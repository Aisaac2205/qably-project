import type { ProposalDetailView, ProposalView } from '../review.contracts';

const EVIDENCE_KIND: Record<string, 'source_excerpt' | 'artifact' | 'url'> = {
  SOURCE_EXCERPT: 'source_excerpt',
  ARTIFACT: 'artifact',
  URL: 'url',
};

export const VIEW_SELECT = {
  id: true,
  projectId: true,
  status: true,
  title: true,
  objective: true,
  preconditions: true,
  steps: true,
  expectedResult: true,
  priority: true,
  evidenceId: true,
  needsManualReview: true,
  targetTestCaseId: true,
  automationKey: true,
  locale: true,
  observations: true,
  createdAt: true,
  evidence: { select: { title: true } },
  targetTestCase: { select: { suiteId: true } },
} as const;

export interface ViewRow {
  id: string;
  projectId: string;
  status: ProposalView['status'];
  title: string;
  objective: string;
  preconditions: string[];
  steps: string[];
  expectedResult: string;
  priority: ProposalView['priority'];
  evidenceId: string;
  needsManualReview: boolean;
  targetTestCaseId: string | null;
  automationKey: string | null;
  locale?: string | null;
  observations?: unknown;
  createdAt?: Date;
  evidence: { title: string } | null;
  targetTestCase: { suiteId: string } | null;
}

export function observationsOf(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const strings = raw.filter(
    (item): item is string => typeof item === 'string',
  );
  return strings.length === 0 ? undefined : strings;
}

export interface EvidenceRow {
  id: string;
  projectId: string;
  kind: string;
  title: string;
  uri: string;
  excerpt: string | null;
  createdAt: Date;
}

export interface LinkRow {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  relation: string;
}

export function toView(row: ViewRow): ProposalView {
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    title: row.title,
    objective: row.objective,
    preconditions: row.preconditions,
    steps: row.steps,
    expectedResult: row.expectedResult,
    priority: row.priority,
    evidenceId: row.evidenceId,
    needsManualReview: row.needsManualReview,
    evidenceTitle: row.evidence === null ? '' : row.evidence.title,
    locale: row.locale ?? null,
    ...(row.createdAt === undefined
      ? {}
      : { createdAt: row.createdAt.toISOString() }),
    ...(observationsOf(row.observations) === undefined
      ? {}
      : { observations: observationsOf(row.observations) }),
    ...(row.targetTestCaseId === null
      ? {}
      : { targetOfficialTestCaseId: row.targetTestCaseId }),
    ...(row.targetTestCase === null
      ? {}
      : { targetOfficialTestCaseSuiteId: row.targetTestCase.suiteId }),
  };
}

export function toEvidence(row: EvidenceRow): ProposalDetailView['evidence'] {
  return {
    id: row.id,
    projectId: row.projectId,
    kind: EVIDENCE_KIND[row.kind],
    title: row.title,
    uri: row.uri,
    ...(row.excerpt === null ? {} : { excerpt: row.excerpt }),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toLink(row: LinkRow): ProposalDetailView['links'][number] {
  return {
    id: row.id,
    from: {
      type: row.fromType as ProposalDetailView['links'][number]['from']['type'],
      id: row.fromId,
    },
    to: {
      type: row.toType as ProposalDetailView['links'][number]['to']['type'],
      id: row.toId,
    },
    relation: row.relation as ProposalDetailView['links'][number]['relation'],
  };
}
