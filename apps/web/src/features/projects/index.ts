/**
 * Public API barrel for the `projects` module.
 *
 * Other modules import from `@/features/projects` (this file), NEVER
 * from internal paths. The api-backed hooks are the only allowed
 * surface for reading and mutating projects.
 */
export { useProjects } from './hooks/use-projects'
export { useCreateProject } from './hooks/use-create-project'
export { useUpdateProject } from './hooks/use-update-project'
export { useDeleteProject } from './hooks/use-delete-project'
export type {
  CreateProjectPayload,
  UpdateProjectPayload,
} from './api/projects.api'
