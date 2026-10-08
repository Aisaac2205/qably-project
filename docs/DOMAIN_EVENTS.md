# Domain events

The API publishes a domain fact after it is committed, and the modules that care about it subscribe. The code that publishes does not know who listens, and the code that listens does not know who published. Today the bus carries the review decision events and the ingestion failure event. Two subscribers listen: one reclassifies a suite after a proposal is approved, the other turns an ingestion failure into a notification.

Before this bus, `ReviewDecisionService.approve` called `ProposalReclassifier.enqueue` itself, and `reject` told nobody. Now `approve` and `reject` publish an event and stop there. In the same way, `IngestionProcessor` used to call `NotificationsPublisher.publish` when an SCM event failed, so ingestion knew its recipient. Now it publishes `scm_event.failed` and stops there.

## Quick path

1. A service finishes its transaction.
2. It calls `DomainEvents.publish(DOMAIN_EVENTS.<name>, payload)`.
3. `DomainEvents` hands the event to the in-process `EventEmitter2` and returns. It never throws.
4. Every provider with `@OnEvent(DOMAIN_EVENTS.<name>)` runs, on a later tick, in the same Node process.

## Events

All names and payload types live in `apps/api/src/common/events/domain-events.ts`. Emitters and subscribers use the `DOMAIN_EVENTS` constants, and `DomainEventMap` ties each name to its payload type, so `publish` rejects a payload that does not match its name.

### `proposal.approved`

Published by `ReviewDecisionService.approve` once the approval transaction has resolved.

| Field | Type | Meaning |
|---|---|---|
| `proposalId` | string | The approved proposal. |
| `projectId` | string | Project of the proposal. |
| `organizationId` | string | Organization of the caller. |
| `suiteId` | string or null | Suite of the published case. Null only when the proposal updated an existing case and the proposal carries no suite. |
| `testCaseId` | string | The case that was created or updated. |
| `versionId` | string | The version the approval published. |
| `createdNewCase` | boolean | True when the approval created the case, false when it published a new version of an existing one. |
| `actorId` | string | The reviewer who approved. |

Subscriber: `ReclassifyOnProposalApproved` (`apps/api/src/modules/proposal-classification/reclassify-on-proposal-approved.subscriber.ts`) enqueues one `reclassify-suite` job for `suiteId`. `ProposalReclassifier` deduplicates by suite and ignores a null suite.

### `proposal.rejected`

Published by `ReviewDecisionService.reject` once the rejection transaction has resolved. Nothing subscribes to it yet.

| Field | Type | Meaning |
|---|---|---|
| `proposalId` | string | The rejected proposal. |
| `projectId` | string | Project of the proposal. |
| `organizationId` | string | Organization of the caller. |
| `suiteId` | string or null | The suite of the proposal, else the suite of the case it targets, else null. |
| `decisionId` | string | The recorded review decision. |
| `actorId` | string | The reviewer who rejected. |

### `scm_event.failed`

Published by `IngestionProcessor` when processing an SCM event throws. The processor first writes the `FAILED` status on the `scm_event` row, then reads the row back for the fields below, publishes, and rethrows the original processing error. If the row is gone by then, nothing is published.

| Field | Type | Meaning |
|---|---|---|
| `scmEventId` | string | The `scm_event` row whose processing failed. |
| `organizationId` | string | Organization that owns the connection. |
| `repo` | string | Repository the event came from, as `owner/name`. |
| `connectionId` | string | The connection that received the event. |

Subscriber: `NotificationsSubscriber` (`apps/api/src/modules/notifications/notifications.subscriber.ts`) queues one `ingestion_failed` notification with severity `high`, payload `{ repo }`, the connection id and the dedupe key `ingestion_failed:<scmEventId>`. That is the notification the processor used to queue itself. `IngestionModule` imports `DomainEventsModule` and no longer imports `NotificationsModule`: the subscriber is part of the application because `AppModule` imports `NotificationsModule`.

The review payloads carry ids only. The reviewer's comment, titles and step text are not in them, so a log line or a future subscriber cannot leak them by accident. `scm_event.failed` also carries the repository name, which the notification shows anyway. It carries no commit message, branch, author, file list or error text.

## Rules for publishing

- **Publish after the commit, never inside a transaction.** An event announces something that already happened. A subscriber that ran before the commit could act on state that rolls back.
- **Publish only when the fact happened.** `approve` publishes nothing when the transaction throws, when a unique constraint fails, or when a concurrent decision wins the claim. `reject` publishes nothing on a lost claim or a failed transaction. `IngestionProcessor` publishes `scm_event.failed` only after the `FAILED` status is written, and never on the success path.
- **Publish once per occurrence.** Each successful decision publishes exactly one event. Each failed processing attempt publishes at most one `scm_event.failed`.
- **The caller's result does not depend on the bus.** The decision is already committed when the event goes out, so a failing emitter or subscriber cannot turn a successful approval into an error. For ingestion, `publishFailure` catches and logs its own errors, so a failing lookup cannot replace the processing error. The processor always rethrows the original one, because BullMQ retries on it.

## Failure isolation

- `DomainEvents.publish` wraps `EventEmitter2.emit` in a try/catch. If the emitter throws, it logs `Failed to publish <name>: <message>` at error level and returns. The log line carries the event name and the error message, never the payload.
- `@nestjs/event-emitter` runs every listener inside its own try/catch. With the default `suppressErrors: true`, a listener error is logged by the `Event` logger and not rethrown, so one failing subscriber cannot reach the publisher or the other subscribers.
- `ReclassifyOnProposalApproved` is registered with `{ async: true }`, so it runs on `setImmediate` after the publisher has returned. It also catches its own errors and logs a warning. `ProposalReclassifier.enqueue` already swallows queue errors, so the handler is a second layer rather than the only one.
- `NotificationsSubscriber` is registered the same way. It catches a failing `NotificationsPublisher.publish` and logs a warning with the SCM event id and the error message, never the repository name.

## Limitation: in-process and at-most-once

The bus is an in-memory `EventEmitter2` inside one Node process. There is no outbox, no queue and no retry on the event itself. Two consequences:

- An event is lost if the process dies between the commit and the moment the handler runs. The decision stays committed, and nothing replays the event.
- An event is not delivered to other API replicas. Each replica handles only the events it published.

This is acceptable for the reclassify subscriber:

- It only enqueues a BullMQ job, and the reclassification it triggers is derived data. The proposal and case rows are already correct, and a lost event leaves an `in_review` proposal's duplicate classification stale until the suite is reclassified again.
- Any later trigger on the suite reclassifies it: a new proposal, a case create or rename, or a run ingest that creates a case.
- `docs/OPS_RECLASSIFY_PENDING_PROPOSALS.md` describes `scripts/reclassify-pending-proposals.ts`, which enqueues a reclassify for every suite that still has an `in_review` proposal. That is the backstop for a lost event.

It is also acceptable for the ingestion failure notification, with a behavior change to be aware of. Before, the processor awaited `NotificationsPublisher.publish` inside the job's catch block, before it rethrew the error. Now it publishes an in-process event and rethrows without waiting for the subscriber:

- The `FAILED` status is written before the event goes out, so the failure itself is never lost. Only the notification of that attempt is lost if the process dies before the handler runs, or if queueing it fails and the handler only logs a warning. Nothing replays it.
- The ingestion queue retries a failing job up to three attempts, and every failing attempt publishes the event again. The notification carries the dedupe key `ingestion_failed:<scmEventId>`, so a retry that fails again does not duplicate it: the in-app notification is upserted by that key and a webhook delivery already marked sent is skipped. The email channel records its delivery under the same key but does not check it before sending, so a repeated failure can send a second email. That was already true before the event.
- A failing publish used to throw out of the catch block and replace the processing error. It no longer can.

Do not subscribe anything to this bus whose loss would leave committed data wrong with no later recovery. That case needs a transactional outbox, which this API does not have.

## Add an event

1. In `apps/api/src/common/events/domain-events.ts`, add a key to `DOMAIN_EVENTS`, a payload interface with `readonly` fields, and an entry in `DomainEventMap`.
2. In the service that owns the fact, inject `DomainEvents` and call `publish` after the transaction has resolved. Import `DomainEventsModule` in that service's module.
3. In the service spec, assert that the event is published once with the expected payload, only after the transaction resolves, and not on the failure paths. `review-decision.service.spec.ts` shows how to hold a transaction open to prove the order.

`DomainEventsModule` registers `EventEmitterModule.forRoot()` and exports `DomainEvents`, so a test module that imports `ReviewModule` or `DomainEventsModule` needs no extra setup. `AppModule` imports it as well.

## Add a subscriber

1. Create a provider in the module of the concern that reacts, not in the module that publishes. Use `@OnEvent(DOMAIN_EVENTS.<name>, { async: true })` and type the parameter with the payload interface.
2. Do not throw. Catch, log a warning with ids only, and return.
3. Add the class to that module's `providers`. `@nestjs/event-emitter` finds subscribers by scanning every provider in the running application at bootstrap, so the module only has to be part of the application graph. `ReviewModule` keeps importing `ProposalClassificationModule` for that reason, and also for `ProposalReclassifier`.
4. Write a wiring test with a real `DomainEventsModule`, as in `reclassify-on-proposal-approved.subscriber.spec.ts`: build a testing module with the subscriber and a stub of its collaborator, call `await moduleRef.init()` (listeners register on application bootstrap, and `compile()` alone does not run it), publish through `DomainEvents`, wait one `setImmediate`, and assert on the collaborator.
