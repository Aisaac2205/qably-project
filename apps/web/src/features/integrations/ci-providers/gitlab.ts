/**
 * GitLab CI provider adapter — STUB.
 *
 * Implementation deferred to a follow-up. Returns `null` for any payload
 * so the route handler responds 501 (Not Implemented). The shape contract
 * is locked in `types.ts` so the consumer code does not change when this
 * is implemented.
 */
import type { NormalizedCIEvent } from './types'

export function normalize(_payload: unknown): NormalizedCIEvent | null {
  return null
}
