import { z } from 'zod';

const name = z.string().trim().min(1).max(80);
const description = z.string().trim().max(500);
const githubRepo = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, 'must be in owner/repository form');
const technologies = z.array(z.string().trim().min(1).max(40)).max(20);

export const createProjectSchema = z.object({
  name,
  description: description.optional(),
  githubRepo: githubRepo.optional(),
  technologies: technologies.default([]),
});

export const updateProjectSchema = z
  .object({
    name: name.optional(),
    description: description.nullable().optional(),
    githubRepo: githubRepo.nullable().optional(),
    technologies: technologies.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'provide at least one field to update',
  });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
