import type { Project, ProjectListItem } from '@qably/types';

export type ProjectView = Project;

export type ProjectListView = ProjectListItem;

export type ProjectError =
  | 'not-found'
  | 'name-taken'
  | 'plan-limit-reached'
  | 'forbidden';
