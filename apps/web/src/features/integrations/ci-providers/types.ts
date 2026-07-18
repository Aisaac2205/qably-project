/**
 * NormalizedCIEvent — provider-agnostic shape for CI webhook events.
 *
 * Every adapter in `ci-providers/` MUST return this shape (or `null` if
 * the inbound payload is not an event we care about). The aggregator
 * (`ci-providers/index.ts`) dispatches by provider and the route handler
 * (`app/api/webhooks/ci/[provider]/route.ts`) consumes only this shape.
 *
 * This is the anti-corruption layer: upstream modules (runs, notifications)
 * never see a GitHub `check_run` or Bitbucket `pipeline_run` payload —
 * only the normalized form.
 */
export type NormalizedCIStatus = 'completed' | 'failed'

export type NormalizedCIProvider = 'github' | 'bitbucket' | 'gitlab'

export interface NormalizedCIEvent {
  /**
   * Stable id for this event. For GitHub it's `check-run-{check_run.id}`;
   * for Bitbucket/GitLab it's the provider's own event id. Used to
   * deduplicate webhooks (providers retry).
   */
  eventId: string
  /**
   * The Qably run this event correlates to. The CI workflow URL embeds
   * a `runId` query param when launched from Qably; the adapter extracts
   * it from the payload headers, env, or commit metadata.
   */
  runId: string
  provider: NormalizedCIProvider
  status: NormalizedCIStatus
  commitSha: string
  /** `owner/repo` style repository identifier. */
  repository: string
  /** Deep link to the run in the provider's UI. */
  url: string
  /** ISO timestamp the adapter received the event. */
  receivedAt: string
}
