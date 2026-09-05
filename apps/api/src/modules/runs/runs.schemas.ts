import { z } from 'zod';

const externalId = z.string().trim().min(1);
const runSource = z.enum(['api', 'github_actions']);
const runName = z.string().trim().min(1).max(200);
const suiteName = z.string().trim().min(1).max(120);
const caseName = z.string().trim().min(1).max(120);
const steps = z.array(z.string().trim().min(1).max(500)).max(50);
const expectedResult = z.string().trim().max(1000);
const caseStatus = z.enum([
  'pending',
  'running',
  'pass',
  'fail',
  'skip',
  'blocked',
]);
const isoDateTime = z.iso.datetime({ offset: true });
const commitSha = z.string().trim().min(1).max(64);
const commitMessage = z.string().trim().max(2000);
const commitAuthor = z.string().trim().max(200);

const ingestCaseSchema = z.object({
  name: caseName,
  suiteName: suiteName.optional(),
  steps: steps.default([]),
  expectedResult: expectedResult.default(''),
  status: caseStatus,
  recordedAt: isoDateTime.optional(),
});

export const ingestRunSchema = z
  .object({
    externalId,
    source: runSource.default('api'),
    suiteId: z.string().min(1).optional(),
    suiteName: suiteName.optional(),
    name: runName,
    startedAt: isoDateTime.optional(),
    finishedAt: isoDateTime.optional(),
    commitSha: commitSha.optional(),
    commitMessage: commitMessage.optional(),
    commitAuthor: commitAuthor.optional(),
    cases: z.array(ingestCaseSchema).min(1),
  })
  .refine(
    (value) =>
      (value.suiteId === undefined) !== (value.suiteName === undefined),
    {
      message: 'provide exactly one of suiteId or suiteName',
      path: ['suiteId'],
    },
  );

export type IngestCaseInput = z.infer<typeof ingestCaseSchema>;
export type IngestRunInput = z.infer<typeof ingestRunSchema>;

export const listRunsQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
  source: z.enum(['manual', 'api', 'github_actions']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
});

export const createManualRunSchema = z.object({
  projectId: z.string().min(1),
  suiteId: z.string().min(1),
  name: runName.optional(),
});

const runCaseStatus = z.enum(['pass', 'fail', 'skip', 'blocked']);

export const updateRunCaseStatusSchema = z.object({
  status: runCaseStatus,
});

export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;
export type CreateManualRunInput = z.infer<typeof createManualRunSchema>;
export type UpdateRunCaseStatusInput = z.infer<
  typeof updateRunCaseStatusSchema
>;

export const ingestJunitQuerySchema = z.object({
  externalId,
  source: runSource.default('api'),
  suiteId: z.string().min(1).optional(),
  suiteName: suiteName.optional(),
  name: runName.optional(),
  startedAt: isoDateTime.optional(),
  finishedAt: isoDateTime.optional(),
  commitSha: commitSha.optional(),
  commitMessage: commitMessage.optional(),
  commitAuthor: commitAuthor.optional(),
});

export type IngestJunitQuery = z.infer<typeof ingestJunitQuerySchema>;
