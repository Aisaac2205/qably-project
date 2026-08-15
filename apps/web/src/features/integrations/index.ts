/**
 * Public API barrel for the `integrations` module.
 *
 * Other modules import from `@/features/integrations` (this file), NEVER
 * from internal paths. This is the REQ-INTEG-005 boundary: the
 * aggregate hook is the only allowed surface for mutating connections.
 */
export { useConnections } from './lib/aggregate'
export type {
  ConnectionAggregate,
  ConnectionInput,
  ConnectionPatch,
  ConnectionAction,
} from './lib/aggregate'
export {
  ConnectionActions,
  ConnectionLogo,
  ConnectionStatus,
  connectionResource,
} from './components/connection-presentation'
