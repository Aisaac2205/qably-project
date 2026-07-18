/**
 * /integrations — public API barrel re-export.
 */
export { useConnections } from '@/features/integrations/lib/aggregate'
export type {
  ConnectionAggregate,
  ConnectionInput,
  ConnectionPatch,
  ConnectionAction,
} from '@/features/integrations/lib/aggregate'
