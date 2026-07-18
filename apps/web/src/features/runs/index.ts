/**
 * Public API barrel for the `runs` module.
 *
 * Other modules import from `@/features/runs` (this file), NEVER from
 * internal paths. This is the REQ-RUN-005 boundary: the aggregate hook
 * is the only allowed surface for mutating runs.
 */
export { useRunAggregate } from './lib/aggregate'
export type { RunAggregate, RunInput, RunPatch, RunAction } from './lib/aggregate'

export { registerRunSubscriber } from './notifications/subscriber'
