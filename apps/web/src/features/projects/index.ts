/**
 * Public API barrel for the `projects` module.
 *
 * Other modules import from `@/features/projects` (this file), NEVER
 * from internal paths. This is the REQ-PROJ-005 boundary: the
 * aggregate hook is the only allowed surface for mutating projects.
 */
export { useProjectAggregate } from './lib/aggregate'
export type {
  ProjectAggregate,
  ProjectInput,
  ProjectPatch,
} from './lib/aggregate'

