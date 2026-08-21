import type { Project } from '@qably/types';

export type ProjectView = Project;

export type ProjectError =
  | 'not-found'
  | 'name-taken'
  | 'plan-limit-reached'
  | 'forbidden';
