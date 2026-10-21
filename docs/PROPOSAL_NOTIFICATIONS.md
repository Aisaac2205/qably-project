# Proposal notifications

When new proposals reach the review inbox, every member of the organization who has the event on (in-app is on by default) gets one `proposals_ready` notification per batch. This page explains what a batch is, how the notification stays at one row while a push is still being processed, and where the numbers can be stale.

Existing proposals are not notified retroactively. Only proposals created after this feature ships raise a notification.

## Quick path

1. A source saves new proposals and commits (`ExtractedProposalWriter`, or `ChatService` for a chat suggestion).
2. It publishes `proposals.created` on the [domain event bus](./DOMAIN_EVENTS.md). It publishes nothing when the call created no proposal.
3. `NotificationsSubscriber` queues one `proposals_ready` job with severity `medium`.
4. `NotificationsProcessor` recounts the batch, then writes or refreshes the in-app notification and fans out to email and webhooks.

## What a batch is

A batch is the set of proposals one occurrence of a source produced. The review inbox filters on it (`batch`, see below), so the id has to name something the inbox can match.

| Source | `source` | Batch id (`batchId`) | Why |
|---|---|---|---|
| A push to a connected repository | `push` | The `IngestionBatch` id (`code_change.batchId`) | One push creates one batch per project of the connection, and every code change of that project points at it. |
| Documenting one automated case | `documentation` | The new proposal id | A document-case job creates a single proposal. There is no batch entity, so the proposal is its own batch. |
| Sending a chat suggestion to review | `chat` | The new proposal id | One send creates one proposal. |

A push only counts the proposals it creates. When a case is still waiting in the inbox from an earlier push, the new push refreshes that proposal and moves it to its own batch instead of opening a second one (see "One open proposal per test case across pushes" in [AI extraction](./AI_EXTRACTION.md)). A push that only refreshed proposals announces nothing. The refreshed proposals show under the new batch when the inbox is filtered by it, because the batch filter follows `code_change.batchId`.

Documenting a whole file or suite (`document-file`) publishes case versions directly and creates no proposal, so it raises no notification. A failed extraction that falls back to a manual-review placeholder does not raise one either: nothing is ready to review.

Only a push has an ingestion batch, so only a push sets `notification.ingestionBatchId`. The column is a plain string with no foreign key and no index. For the other sources the batch id lives in the payload only.

## Notification payload

`payload` is `Record<string, string | number>`.

| Field | Sources | Meaning |
|---|---|---|
| `source` | all | `push`, `documentation` or `chat`. |
| `count` | all | Proposals waiting in the batch. A number, so the copy can pick the singular or plural text. |
| `projectId` | all | Project that owns the proposals. |
| `batchId` | all | See the table above. |
| `commitSha` | push | Tip commit the code change was attributed to. Omitted when empty. |
| `author`, `branch` | push | From the SCM event. Omitted when the event is no longer on record. |

The web link is `/review-inbox?projectId=<projectId>&batch=<batchId>`.

## Opening a batch in the review inbox

`GET /review/inbox` and `GET /review/inbox/counts` take an optional `batch` query parameter, so the notification link shows only the proposals it announced.

| Parameter | Rule |
|---|---|
| `batch` | Optional. Trimmed, 1 to 64 characters. A blank value is a `400`, like a blank `search`. |

The value is either an ingestion batch id or a proposal id, and one query matches both:

```text
codeChange.batchId = <batch>   (a push)
OR id = <batch>                (a source that creates one proposal)
```

Details that keep the filter safe to add:

- Omitting `batch` changes nothing. No condition is added and the existing queries and cursors behave as before.
- The condition sits in its own `AND`, because the search filter already uses the top-level `OR`. Every page of a cursor walk stays inside the batch, since the keyset condition wraps the base filter.
- The organization scope is untouched, so a batch id from another organization matches nothing.
- `counts` takes the same parameter, so the status tabs count the batch the list shows. Without it a link would open a list of 18 under a tab that says 214.
- `status` still defaults to `in_review`. A batch whose proposals were all decided opens an empty list; pass `status=all` to see them.

## One row per batch

A push with N test files runs N `code-change` jobs, and each one announces the same batch. The notification table has `@@unique([userId, organizationId, dedupeKey])`, so the processor upserts on the dedupe key and the batch keeps one row per member.

| Source | Dedupe key |
|---|---|
| `push` | `proposals:push:<ingestionBatchId>` |
| `documentation` | `proposals:documentation:<proposalId>` |
| `chat` | `proposals:chat:<proposalId>` |

The push key uses the ingestion batch, not the SCM event. One push reaches every project of its connection, and each project has its own batch, inbox and link. Keying on the SCM event would merge two projects into one notification that links to only one of them.

### The count is read again, not added up

Each job carries only its own share, so the processor does not trust the number in the job. For a push it counts the proposals still `in_review` in that batch (scoped to the organization) and writes that number. Three things follow:

- A retried job reads the same number, so a retry never inflates the count.
- Jobs that finish out of order cannot leave a wrong total behind: the last one to be processed reads the full batch.
- A batch with nothing left in review (every proposal decided before the job ran) raises no notification.

The count is the number of proposals waiting now, not the number created. If a reviewer decides three proposals before the last job runs, the notification says so.

### Upsert behaviour

Most events keep the first write and ignore a repeat. `proposals_ready` is the exception: a repeat replaces `payload` and nothing else. The row keeps its id, `createdAt` and `readAt`.

A member who already read the notification does not see it become unread when the count grows. That keeps a long push from re-alerting people, at the cost that a count raised after reading is only visible in the panel or the inbox.

## Channels

| Channel | Default | Behaviour |
|---|---|---|
| In-app | on | Upserted as above. |
| Email | off | Sent once per recipient and dedupe key. A later job of the same batch skips a recipient whose email was already sent, and retries one whose earlier delivery failed. |
| Slack, Discord | off | Same rule through `notification_delivery` (`webhookId` + dedupe key), and the message links to the inbox batch. |

Email and webhooks are one-shot per batch. They carry the count the first processed job read, which can be lower than the final number for a push with several files. The in-app notification is the one that converges. The email template has no action link, so only webhooks link to the batch.

## Limitations

- **At-most-once.** The event bus is in-process and has no outbox. If the process stops between the commit and the publish, that announcement is lost. A retried job finds the proposal already pending and creates nothing, so it does not recover it either.
- **Concurrent processors.** One notifications worker takes one job at a time, so it cannot race itself. With several API instances, two jobs of one batch can read the count at different moments, and the slower write can land last with a slightly lower number. It stays that way until another job of the batch runs.
- **No debounce.** Nothing delays the first job of a push. The first notification appears as soon as the first file finishes and grows afterwards.
