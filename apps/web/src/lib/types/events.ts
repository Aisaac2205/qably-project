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
 * 'case.failed'       → features/runs      (useRunAggregate.transition('fail'))  [C3]
 * 'run.started'       → features/runs      (useRunAggregate.transition('start')) [C3]
 * 'run.completed'     → features/runs      (useRunAggregate.transition('complete')) [C3]
 * 'connection.added'  → features/integrations (useConnections.transition('connect')) [C2]
 * 'connection.removed'→ features/integrations (useConnections.transition('disconnect')) [C2]
 * 'payment.received'  → features/billing (webhook / simulate) [C4]
 *
 * Marker unions for events introduced in later commits (`run.*`, `connection.*`,
 * `payment.*`) are typed here in C1 so the bus is fully typed end-to-end from
 * day one — extensions in C2-C4 only add behaviour, not new payload fields.
 */
import type { RunSource, RunStatus } from '@qably/types'
import type { NormalizedCIEvent } from '@/features/integrations/ci-providers/types'

export interface AppEventMap {
  'project.created': { projectId: string }
  'project.updated': { projectId: string }

  'suite.added': { projectId: string; suiteId: string }
  'case.confirmed': { projectId: string; caseId: string }

  'case.failed': { runId: string; caseId: string; projectId: string }
  'run.started': { runId: string; projectId: string; source: RunSource }
  'run.completed': {
    runId: string
    projectId: string
    status: RunStatus
    url: string
  }

  'ci.event.received': { event: NormalizedCIEvent }

  'connection.added': { connectionId: string; provider: 'github' | 'bitbucket' | 'gitlab' }
  'connection.removed': { connectionId: string }

  'payment.received': { invoiceId: string; amount: number; currency: string }
}
