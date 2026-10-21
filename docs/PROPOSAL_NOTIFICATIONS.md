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

## When a push is skipped

Every file a push sends to extraction costs one AI credit and one unit of the daily budget, and a push can match any number of files. `EXTRACTION_MAX_FILES_PER_BATCH` bounds that: when the files of one project batch that matched a test pattern are more than the limit, `ExtractionService.enqueueCodeChanges` queues none of them. The batch is skipped whole, not truncated, because a partial batch would leave tests missing from the review inbox with nothing to show which.

**There is no resume action yet.** Skipping is final for that push. The batch was already created as `COMPLETED`, and documenting files from the suites only reaches cases that already exist, so it cannot recover the code changes of a skipped batch. The way to get proposals for those tests today is to push fewer test files at a time. A button that re-queues a skipped batch is a follow-up.

| | |
|---|---|
| Setting | `EXTRACTION_MAX_FILES_PER_BATCH`, a positive integer. Default `50`. Not set, or set to an empty value, means 50. `0`, a negative number or a decimal stops the API from starting. |
| Counted | Files of one ingestion batch, which is one push for one project, that matched a test pattern. Files that matched none are not counted. |
| Bound per push | The limit applies per project, not per push. A push to a connection with N projects can queue up to N times the limit. |
| At the limit | Exactly the limit is allowed. Only more than the limit skips the batch. |
| Dedupe key | `extraction_capped:<ingestionBatchId>`, so a second event for the same batch does not duplicate the notification. A repeat keeps the first write and leaves the row as it was. |
| Event | `extraction.capped`, see [DOMAIN_EVENTS.md](./DOMAIN_EVENTS.md#extractioncapped). |

Nobody loses the signal: every member who has the event on (in-app is on by default, email is off) gets one `extraction_capped` notification with severity `high`, and so does every Slack or Discord channel subscribed to it:

> Proposals were not extracted from 120 test files because this push exceeds the limit of 50 test files per push. Push fewer test files at a time to extract them.

The copy says "push" because that is what the reader sees; the count is for the project the notification names. The payload is `{ count, limit, projectId, batchId }`. The row stores the project and the ingestion batch, the in-app link is `/projects/<projectId>/repository`, and the Slack or Discord message links to the same page. The email template has no action link. The preference lives under Review in Settings, next to `proposals_ready`.

### Raising the limit

1. Set `EXTRACTION_MAX_FILES_PER_BATCH` to the new value in the API environment and restart the API. The value is read when the API starts.
2. Check `AERIS_DAILY_BUDGET` first. The limit is the per-batch bound and the daily budget is the per-day one, so a higher limit with an unset budget lets one large push spend without limit.
3. A push that was already skipped is not replayed. The next push is judged against the new limit.

### What the log line says

One warning per skipped batch: `Extraction skipped for project <projectId> batch <batchId>: <count> test files exceed the limit of <limit> per batch.` It carries ids and numbers only, never file names or commit data. If the code change rows are gone by the time the limit is checked, the batch is still skipped, the line names the organization instead, and no notification is queued. If reading the rows or publishing the event fails, the batch is skipped as well and a warning with the error message is logged: the check never throws, because a failing ingestion job would be retried into the unique index on the SCM event and project and could never queue anything either.

## Limitations

- **At-most-once.** The event bus is in-process and has no outbox. If the process stops between the commit and the publish, that announcement is lost. A retried job finds the proposal already pending and creates nothing, so it does not recover it either.
- **Concurrent processors.** One notifications worker takes one job at a time, so it cannot race itself. With several API instances, two jobs of one batch can read the count at different moments, and the slower write can land last with a slightly lower number. It stays that way until another job of the batch runs.
- **No debounce.** Nothing delays the first job of a push. The first notification appears as soon as the first file finishes and grows afterwards.
