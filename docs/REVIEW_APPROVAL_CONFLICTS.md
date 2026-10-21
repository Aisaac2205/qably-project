# Review approval conflicts

Approving a proposal can fail because the official case it would create or update breaks a unique constraint on `test_case`. The API used to answer every one of those failures with the same `409 name-taken`, whatever constraint fired, and logged nothing. The proposal stayed `in_review`, every retry repeated the same 409, and the reviewer could only reject it.

`POST /review/proposals/:id/approve` now says which constraint failed, names the official case that already holds the value, and writes one log line per failure. Rejecting the proposal still works.

## Quick path

1. The reviewer approves and gets a 409 whose `code` is `name-taken`, `automation-key-taken` or `publish-conflict`.
2. `conflictingCase` names the official case that blocks the approval, or is `null` when it cannot be resolved.
3. The API logs `Approval blocked by a unique constraint: ...` with the ids needed to investigate.
4. The reviewer can reject the proposal. When a new case (a proposal without a target) hits `automation-key-taken`, the suite is reclassified, and the proposal should come back as an update of the conflicting case. A conflict on an approval that already targets a case never queues a reclassify, whatever constraint fails.

## Why approval fails

Approval runs in one transaction (`ReviewDecisionService.publish`, `apps/api/src/modules/review/review-decision.service.ts`):

1. With a target, lock its `test_case` row (`SELECT ... FOR NO KEY UPDATE`, `lockTestCaseForUpdate` in `apps/api/src/modules/review/lib/lock-test-case.ts`). The lock comes before the claim and before the versions are counted, so two writers of the same case publish one after the other: version n+1 is computed by one writer at a time. A document-file job takes the same lock, after spending its credit; approval spends none, so it has no organization row to lock first. The mode is `FOR NO KEY UPDATE` rather than `FOR UPDATE` because a reclassify updates a proposal of this case and then needs a foreign-key share lock on the case: `FOR UPDATE` blocks that share lock, so the reclassify (holding the proposal) and the approval (holding the case, waiting to claim the proposal) would deadlock.
2. Claim the proposal: `in_review` to `approved`.
3. With no `targetTestCaseId`, create a `TestCase` with `name = proposal.title` and, when the proposal has an `automationKey`, `automationKey = proposal.automationKey`.
4. With a target, publish a new version and rewrite the target's `name`. The flow rewrites the target's `automationKey` only when the proposal carries one; a proposal without an `automationKey` leaves the target's key untouched.

Steps 3 and 4 can break these constraints (`apps/api/prisma/schema.prisma`, model `TestCase`):

| Constraint | Postgres index | Code |
|---|---|---|
| `@@unique([suiteId, name])` | `test_case_suiteId_name_key` | `name-taken` |
| `@@unique([suiteId, automationKey])` | `test_case_suiteId_automationKey_key` | `automation-key-taken` |
| Any other unique index, for example `test_case_version_testCaseId_version_key` if a writer publishes a version without taking the case lock | varies | `publish-conflict` |

When a constraint fails, the transaction rolls back, so the proposal stays `in_review`. Retrying the same approval fails the same way until the data changes.

A transaction that Postgres aborts as a deadlock victim or a serialization failure is different: it rolled back whole and would succeed on a second try. `ReviewDecisionService.approve` runs it once more (`retryTransientConflicts`, `apps/api/src/modules/review/lib/transient-transaction-conflict.ts`) before the error reaches the reviewer.

## How the API tells the constraints apart

The API runs Prisma 7 (`@prisma/client` 7.8.0) through the `@prisma/adapter-pg` driver adapter (7.9.1). Checked against the installed runtime, a unique violation surfaces as:

```text
PrismaClientKnownRequestError
  code: 'P2002'
  meta: {
    driverAdapterError: DriverAdapterError {
      name: 'DriverAdapterError',
      cause: {
        originalCode: '23505',
        originalMessage: 'duplicate key value violates unique constraint "test_case_suiteId_name_key"',
        kind: 'UniqueConstraintViolation',
        constraint: { fields: ['"suiteId"', 'name'] }
      }
    }
  }
```

- There is no `meta.target` with a driver adapter. Code that reads `meta.target` alone always sees nothing.
- `constraint.fields` comes from the Postgres `DETAIL` line (`Key ("suiteId", name)=(...)`), so camelCase columns keep their double quotes. Postgres leaves out `DETAIL` when the user lacks column privileges, and `constraint` is then `undefined`.
- The index name only shows up inside `originalMessage`.

`uniqueViolationTarget` (`apps/api/src/prisma/unique-violation-target.ts`) reads the unquoted fields first, then the index name from `originalMessage`, then `meta.target` for engines that still report it. `testCaseUniqueConstraint` (`apps/api/src/modules/review/lib/test-case-unique-constraint.ts`) maps the result to `name`, `automationKey` or `unknown`. `isUniqueViolation` is unchanged.

`ApprovalConflictDiagnoser` (`apps/api/src/modules/review/approval-conflict-diagnoser.ts`) turns that constraint into the `code`, looks up the conflicting case, writes the log line and queues the reclassify. `ReviewDecisionService.approve` only delegates to it.

A missing or malformed `driverAdapterError.cause` (no cause, a cause that is not an object, non-string or empty `fields`, an `originalMessage` that names no index) never throws. The constraint degrades to `unknown`, so the response is `publish-conflict` with `conflictingCase: null`.

The test fixture `apps/api/test/support/prisma-unique-violation.ts` builds this exact shape with the real `Prisma.PrismaClientKnownRequestError` class. Unit and e2e tests use it instead of a bare `{ code: 'P2002' }`.

## The 409 contract

```json
{
  "statusCode": 409,
  "code": "automation-key-taken",
  "message": "Another official case in this suite already runs as that automated test",
  "conflictingCase": {
    "id": "cmum0000000000000000000000",
    "name": "Empties the cart",
    "suiteId": "cmum1111111111111111111111"
  },
  "path": "/review/proposals/cmum2222222222222222222222/approve",
  "timestamp": "2026-09-28T22:19:01.000Z"
}
```

| `code` | `message` | `conflictingCase` |
|---|---|---|
| `name-taken` | Another official case in this suite already uses that title | The case in the same suite whose `name` equals the proposal title |
| `automation-key-taken` | Another official case in this suite already runs as that automated test | The case in the same suite whose `automationKey` equals the proposal's |
| `publish-conflict` | Publishing collided with another change to the official cases. Try again | Always `null` |
| `stale-proposal` | The case has a newer published version than the one this proposal was reviewed against | Not sent (see "Approving over a newer version") |

- **Organization scope.** The lookup filters on `project.organizationId` of the caller, so a case from another organization is never returned. When nothing matches, `conflictingCase` is `null`.
- **Update path.** When the proposal targets an existing case, the lookup runs in that case's suite and excludes the target itself. No reclassify is queued on this path, even for `automation-key-taken`.
- **Lookup failure.** The lookup is a diagnostic, so it never turns the 409 into a 500. When the query itself fails (database error, timeout), the response keeps the right `code` and returns `conflictingCase: null`, and the API logs one extra `warn` before the usual line: `Conflicting case lookup failed: proposal=<proposalId> suite=<suiteId>`. It carries ids only, never the error message, the title or the `automationKey`. The reclassify rule is unaffected.
- **Shared types.** `ReviewApprovalConflictCode` and `ReviewConflictingCase` live in `packages/types/src/index.ts`. Rebuild the package (`pnpm --filter @qably/types build`) after changing them, because consumers read `dist/`.
- **Envelope.** `AllExceptionsFilter` only forwards whitelisted keys, and `conflictingCase` is now one of them.
- **Other responses are unchanged.** `invalid-transition` still carries `decision`, and a successful approval returns the same `ApprovalView`.

## Reading the log line

Each unique-constraint failure on approval writes one `warn` from `ApprovalConflictDiagnoser`:

```text
Approval blocked by a unique constraint: proposal=<proposalId> suite=<suiteId|unknown> constraint=<name|automationKey|unknown> conflictingCase=<caseId|none>
```

| Field | Meaning |
|---|---|
| `proposal` | The proposal being approved |
| `suite` | The suite the case would be written to: the resolved suite for a new case, or the target case's suite for an update |
| `constraint` | Which constraint failed |
| `conflictingCase` | The id of the official case holding the value, or `none` when it is not visible or the constraint is `unknown` |

The line never contains the title, the `automationKey` or any source code. To see the conflicting values, look up both ids in the database.

When the conflicting case lookup fails, a second line precedes it and the first one ends with `conflictingCase=none`:

```text
Conflicting case lookup failed: proposal=<proposalId> suite=<suiteId>
```

## What this slice prevents, and what it does not

**Implemented: reclassify after an `automationKey` conflict on a new case.** Only when a proposal without a target collides on `automationKey`, the API queues a reclassification of the suite (`ProposalReclassifier.enqueue`). A conflict on an approval that already has a target never queues one; a successful approval still queues its own reclassify. `ReclassifySuiteProcessor` already sets `targetTestCaseId` when an in-suite case has the same `automationKey` and the proposal has no target. The proposal then shows up as an **update** of that case, and the next approval, still a human decision, publishes a new version instead of a duplicate create. A failing enqueue does not change the 409: `ProposalReclassifier.enqueue` logs the failure and returns.

**Not implemented: silently retargeting at approval time.** Approval could turn a create into a version of the colliding case on the spot. That would overwrite an official case the reviewer never saw in the card. Reclassifying first shows the change before anyone approves it.

**Not implemented: deduplicating titles while writing proposals.** Renaming AI titles on the way in (suffixes, digests) would change content nobody reviewed, would not fix proposals already pending, and still leaves a clash against an ingested case name. A `name-taken` conflict needs a human choice.

## Where collisions come from

| Source | Constraint | Persists across retries | Status |
|---|---|---|---|
| The proposal title equals the humanized name of a case created by JUnit ingestion, and the AI `automationKey` does not exactly equal the ingested key, so no target is resolved | name | Yes | Plausible, unverified in production |
| A previous extraction of the same test was approved under a different `automationKey`, and the new proposal reuses the title | name | Yes | Plausible, unverified |
| Two cases in one batch get the same title from different tests (different keys) | name | Yes, for the second approval | Plausible for one proposal per batch, not for three |
| The target case is renamed to a title another case in the suite already uses | name | Yes | Possible |
| An official case gets the same `automationKey` after the proposal was written (ingestion or another approval) | automationKey | No: ingestion and approval both reclassify the suite (approval through the `proposal.approved` event, see `DOMAIN_EVENTS.md`), which sets the target | Unlikely to persist |
| The proposal has no `suiteId`, so approval falls back to the default suite, which the reclassifier never visits | automationKey | Yes | Edge case |
| Two writers (approvals, document-file jobs) publish a version to the same case at the same time | other (`publish-conflict`) | No | Prevented: both take the case lock before counting versions, so the second waits and publishes the next number |

Which constraint fired for the production reports of September 2026 is unverified. The new log line answers it the next time a reviewer hits the conflict.

## What the reviewer sees

The web client (`apps/web/src/features/review-inbox`) turns each conflict into an alert and keeps the queue usable.

- **Message.** Each `code` has its own message that names the proposal: `aiReview.decisionNameTaken`, `decisionAutomationKeyTaken`, `decisionAutomationKeyTakenWithCase` and `decisionPublishConflict`. The `automation-key-taken` message names the conflicting case when `conflictingCase` is present. `name-taken` and `automation-key-taken` also show a **View existing case** link to that case. `publish-conflict` never has a case, so it has no link.
- **No promise of success.** `publish-conflict` is also the fallback for a constraint the API could not classify, and retrying that fails the same way. Its message says the proposal could not be published because of a conflict and offers trying again later or rejecting.
- **Queue.** Every code except `invalid-transition` reverts the optimistic removal, so the proposal returns to the queue with both decisions enabled.
- **Guarded re-selection.** `useReviewInboxSelection.reselectAfterFailure` brings the failed proposal back into the inspector only on desktop, and only when nothing is selected (the list emptied after the optimistic removal) or the live selection is that same proposal. A proposal the reviewer already moved to is never replaced.
- **Mobile never reopens the detail.** A late failure on a narrow viewport only shows the error. It does not push history, select the proposal or move focus, so it cannot pull someone away from the list they are browsing.
- **Unmounted page.** A failure that arrives after the page unmounted does not touch history, selection or focus.
- **Error list cap.** At most three alerts show, newest last. Older ones collapse into one line, "And N more errors", whose **Clear** control removes only the hidden ones. Identical messages merge into one alert with "Happened N times", and dismissing it removes every occurrence. The list scrolls past a maximum height, so it cannot push the queue out of view.

## Approving over a newer version (`stale-proposal`)

A proposal for an existing case is reviewed against the case's published version, which the inspector shows as "Changes from published version N". The case can get a newer version while the proposal waits: a document-file job (the suite's **Document** action), another approval, or a person editing the case. Approving would then publish over a version the reviewer never compared against, and the last writer would win without anyone noticing.

The approval carries the version the reviewer saw, and the API refuses when the case has moved past it:

1. `GET /review/proposals/:id` returns `publishedVersion.id`.
2. The web client sends it back as `baseVersionId` on `POST /review/proposals/:id/approve` (`useProposalDecision`, read from the cached proposal detail). It sends `null` when the inspector showed no published version, and leaves the field out when the detail never loaded.
3. Inside the approval transaction, after locking the case row, `ReviewDecisionService.publish` compares the case's `currentVersionId` with that base. A mismatch rolls back with `409 stale-proposal`: nothing is claimed or published, and the proposal stays `in_review`.
4. A successful approval records the version it superseded in `ExtractedProposal.baseVersionId` (migration `20261021150000_add_proposal_base_version`).

| Request `baseVersionId` | Proposal `baseVersionId` | Check |
|---|---|---|
| A version id | any | The case must still be at that version |
| `null` | any | The case must still have no published version |
| left out | a version id | The case must still be at the proposal's base |
| left out | `null` (every row created before this change) | Skipped, the legacy behaviour |

The check only applies when the approval updates an existing case, the proposal's target or the matched case of `applyTo: 'matched-case'`. A new case has no version to be stale against.

**Why the base comes from the request.** Proposals for existing cases are written by `ExtractedProposalWriter`, and recording the base when the proposal is created would mean changing that writer. The request variant needs no writer change and checks what matters: the version the reviewer actually compared against, including a refetch of the detail after they opened it. The column still lets a writer record the base at creation later; approval already honours it when the request sends none.

**Before deciding.** `GET /review/proposals/:id` also returns `matchedCase.documentation` (`queuedAt`, `outcomeAt`) for the case the proposal would update. While a documentation run is queued with no later outcome, the inspector shows `CaseDocumentingNotice` (`reviewInbox.caseDocumentingNotice`): Aeris is documenting this case, approving may conflict with its result, wait and compare again. It is a `role="note"` with a Phosphor icon and the AI accent tokens, and only shows on a proposal still in review.

**Approving while a documentation run is queued.** The approval wins. Publishing clears the case's `documentationQueuedAt`, which is the queued run's claim on the case, and the document-file job checks that claim under the case lock: it skips a case whose marker is gone without writing anything, so the approved version and its documentation outcome stay. The run documents the case only if someone queues it again after the approval (see "A run only writes the cases it still owns" in `docs/AI_EXTRACTION.md`). The other order, the run publishing first, is the `stale-proposal` case above.

**What the reviewer sees.** `aiReview.decisionStaleProposal` names the proposal and says the case got a newer version from Aeris or a teammate. Like the other approval conflicts, the proposal goes back into the queue and the inspector, and the lists refetch, so the comparison now shows the new version. Approving again sends the new base and goes through.

## Follow-ups

The API slice only makes the 409 precise. The web now shows each conflict; the paths that resolve one are not built.

| Owner | Work | Contract | Status |
|---|---|---|---|
| Web | Handle `automation-key-taken` and `publish-conflict` in `apps/web/src/features/review-inbox/lib/decision-error.ts`, each with its own message | `code` as above | Implemented |
| Web | Show `conflictingCase.name` and link to the case so the reviewer can compare before rejecting | `conflictingCase: { id, name, suiteId } \| null` | Implemented |
| Web | After `automation-key-taken`, refetch the proposal: it should come back as an update once the reclassify job runs | Existing proposal detail endpoint | Not implemented |
| API and web | Give reviewers a way out of `name-taken` besides rejecting: an optional title override on approve, validated like extraction titles (1 to 120 characters) | Proposed: `POST /review/proposals/:id/approve` body `{ comment?: string, title?: string }` | Not implemented. The approve body accepts no `title` today |
| API and web | Let the reviewer resolve `name-taken` or `automation-key-taken` by publishing the proposal as a new version of `conflictingCase`, as an explicit human choice made after seeing that case | Not designed | Not implemented |
| API | Include proposals with a null `suiteId` in reclassification, or backfill their suite | None | Not implemented |
