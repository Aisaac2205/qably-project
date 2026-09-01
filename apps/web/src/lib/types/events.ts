/**
 * AppEventMap — typed event payloads emitted on the in-process event bus.
 *
 * Each key is a domain event. The value is the exact payload shape.
 * Producers (which aggregate emits) and consumers (which subscriber reacts)
 * both reference this map, so renaming a key breaks the compile.
 *
 * Event → Producer (and when it fires)
 * ────────────────────────────────────────────────────────────────────
 * 'project.created'   → features/projects (useProjectAggregate.create)
 * 'project.updated'   → features/projects (useProjectAggregate.update)
 * 'suite.added'       → features/projects (useProjectAggregate.addSuite)
 * 'case.confirmed'    → features/projects (useProjectAggregate.confirmCase)
 * 'connection.added'  → features/integrations (useConnections.transition('connect')) [C2]
 * 'connection.removed'→ features/integrations (useConnections.transition('disconnect')) [C2]
 * 'payment.received'  → features/billing (webhook / simulate) [C4]
 *
 * Runs are now read from and written to the real API (see
 * `features/runs/api/runs.api.ts`) instead of the mock store's aggregate, so
 * the transitional `run.started` / `run.completed` / `ci.event.received`
 * events and the mock run subscriber that reacted to them were retired
 * along with the simulated CI webhook route.
 */
export interface AppEventMap {
  'project.created': { projectId: string }
  'project.updated': { projectId: string }

  'suite.added': { projectId: string; suiteId: string }
  'case.confirmed': { projectId: string; caseId: string }

  'case.failed': { runId: string; caseId: string; projectId: string }

  'connection.added': { connectionId: string; provider: 'github' | 'bitbucket' | 'gitlab' }
  'connection.removed': { connectionId: string }

  'payment.received': { invoiceId: string; amount: number; currency: string }
}
