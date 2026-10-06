import { SUITE_RUN_STATUSES, SUITE_SUMMARY_SORTS } from '@qably/types';
import { z } from 'zod';
import { decodeSuiteSummariesCursor } from './lib/suite-summaries-cursor';

const projectId = z.string().min(1);
const name = z.string().trim().min(1).max(120);
const description = z.string().trim().max(1000);
const tags = z.array(z.string().trim().min(1).max(40)).max(20);
const objective = z.string().trim().max(500);
const preconditions = z.array(z.string().trim().min(1).max(300)).max(20);
const steps = z.array(z.string().trim().min(1).max(500)).max(50);
const expectedResult = z.string().trim().max(1000);
const priority = z.enum(['critical', 'high', 'medium', 'low']);
const state = z.enum(['active', 'draft', 'deprecated']);

export const createSuiteSchema = z.object({
  projectId,
  name,
  description: description.default(''),
  tags: tags.default([]),
  isDefault: z.boolean().default(false),
});

export const updateSuiteSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    tags: tags.optional(),
    isDefault: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'provide at least one field to update',
  });

export const createCaseSchema = z.object({
  name,
  objective: objective.default(''),
  preconditions: preconditions.default([]),
  steps: steps.default([]),
  expectedResult: expectedResult.default(''),
  priority: priority.default('medium'),
  state: state.default('active'),
});

export const updateCaseSchema = z
  .object({
    name: name.optional(),
    objective: objective.optional(),
    preconditions: preconditions.optional(),
    steps: steps.optional(),
    expectedResult: expectedResult.optional(),
    priority: priority.optional(),
    state: state.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'provide at least one field to update',
  });

export const listSuitesQuerySchema = z.object({
  projectId: projectId.optional(),
});

export const listSuiteSummariesQuerySchema = z
  .object({
    projectId,
    limit: z.coerce.number().int().min(1).max(100).default(50),
    sort: z.enum(SUITE_SUMMARY_SORTS).default('recent'),
    search: z.string().trim().min(1).max(200).optional(),
    tag: z.string().min(1).max(40).optional(),
    status: z.enum(SUITE_RUN_STATUSES).optional(),
    cursor: z.string().min(1).max(2048).optional(),
  })
  .transform(({ cursor, ...query }, ctx) => {
    const position =
      cursor === undefined ? undefined : decodeSuiteSummariesCursor(cursor);

    if (position === null || (position && position.sort !== query.sort)) {
      ctx.addIssue({
        code: 'custom',
        path: ['cursor'],
        message:
          'cursor must be a valid opaque suite summaries cursor for the requested sort',
      });
      return z.NEVER;
    }

    return { ...query, cursor: position };
  });

export const listSuiteTagsQuerySchema = z.object({ projectId });

export const confirmDocumentationSchema = z
  .object({ caseIds: z.array(z.string().min(1)).min(1).max(500).optional() })
  .default({});

export type CreateSuiteInput = z.infer<typeof createSuiteSchema>;
export type UpdateSuiteInput = z.infer<typeof updateSuiteSchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type ListSuitesQuery = z.infer<typeof listSuitesQuerySchema>;
export type ListSuiteSummariesQuery = z.infer<
  typeof listSuiteSummariesQuerySchema
>;
export type ListSuiteTagsQuery = z.infer<typeof listSuiteTagsQuerySchema>;
export type ConfirmDocumentationInput = z.infer<
  typeof confirmDocumentationSchema
>;
