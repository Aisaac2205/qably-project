import { z } from 'zod';

const name = z.string().trim().min(1).max(120);
const description = z.string().trim().max(1000);
const tags = z.array(z.string().trim().min(1).max(40)).max(20);
const steps = z.array(z.string().trim().min(1).max(500)).max(50);
const expectedResult = z.string().trim().max(1000);
const priority = z.enum(['critical', 'high', 'medium', 'low']);
const state = z.enum(['active', 'draft', 'deprecated']);

export const createSuiteSchema = z.object({
  projectId: z.string().min(1),
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
  steps: steps.default([]),
  expectedResult: expectedResult.default(''),
  priority: priority.default('medium'),
  state: state.default('active'),
});

export const updateCaseSchema = z
  .object({
    name: name.optional(),
    steps: steps.optional(),
    expectedResult: expectedResult.optional(),
    priority: priority.optional(),
    state: state.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'provide at least one field to update',
  });

export const listSuitesQuerySchema = z.object({
  projectId: z.string().min(1).optional(),
});

export type CreateSuiteInput = z.infer<typeof createSuiteSchema>;
export type UpdateSuiteInput = z.infer<typeof updateSuiteSchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type ListSuitesQuery = z.infer<typeof listSuitesQuerySchema>;
