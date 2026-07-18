/**
 * Run subscriber — listens to `ci.event.received` on the bus and
 * transitions the corresponding run via the run aggregate.
 *
 * Per the design (Commit 3, run-notifications slice):
 * - `dispatcher.ts` lives in `features/integrations/` — it knows about
 *   external systems (Slack, email). The dispatcher is NOT wired in
 *   Commit 3 (it ships in Commit 4 / billing). What we wire here is
 *   the cross-module glue: CI events arrive, runs transition.
 * - The run aggregate emits `run.completed`; future notification
 *   subscribers (in integrations/ or in this same file) pick that up.
 *
 * Returns an unsubscribe function (HMR-safe via `useEffect` cleanup
 * in `app-shell.tsx`). The bus is pinned to `globalThis` (per C1), so
 * the same instance is used across re-renders and the listener is
 * never duplicated.
 *
 * For the demo, the "Simulate CI webhook" button on /integrations sends
 * a GitHub-shaped payload whose `external_id` is a real runId. This
 * subscriber finds that run and transitions it.
 */
import { eventBus } from '@/lib/event-bus'
import { getRun, transitionRun } from '@/lib/mock-store'

/**
 * Strip the provider prefix that the CI adapters add (e.g., the GitHub
 * adapter produces `github-run-13` from `external_id: 'run-13'`).
 * Returns the bare runId that the mock-store uses as the key.
 */
function stripProviderPrefix(runId: string): string {
  if (runId.startsWith('github-')) return runId.slice('github-'.length)
  if (runId.startsWith('bitbucket-')) return runId.slice('bitbucket-'.length)
  if (runId.startsWith('gitlab-')) return runId.slice('gitlab-'.length)
  return runId
}

export function registerRunSubscriber(): () => void {
  return eventBus.on('ci.event.received', ({ event }) => {
    const bareRunId = stripProviderPrefix(event.runId)
    const run = getRun(bareRunId)
    if (!run) {
      // eslint-disable-next-line no-console
      console.log('[run-subscriber] no run found for ci event', { runId: bareRunId, eventId: event.eventId })
      return
    }
    if (run.status !== 'running') {
      // eslint-disable-next-line no-console
      console.log('[run-subscriber] run not in running state', { runId: bareRunId, status: run.status })
      return
    }
    const action = event.status === 'failed' ? 'fail' : 'complete'
    const updated = transitionRun(bareRunId, action)
    if (updated) {
      eventBus.emit('run.completed', {
        runId: bareRunId,
        projectId: updated.projectId,
        status: updated.status,
        url: '', // Run type does not carry a URL field; reserved for future
      })
    }
  })
}
