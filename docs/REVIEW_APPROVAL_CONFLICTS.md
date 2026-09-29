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

1. Claim the proposal: `in_review` to `approved`.
2. With no `targetTestCaseId`, create a `TestCase` with `name = proposal.title` and, when the proposal has an `automationKey`, `automationKey = proposal.automationKey`.
3. With a target, publish a new version and rewrite the target's `name`. The flow rewrites the target's `automationKey` only when the proposal carries one; a proposal without an `automationKey` leaves the target's key untouched.

Steps 2 and 3 can break these constraints (`apps/api/prisma/schema.prisma`, model `TestCase`):

| Constraint | Postgres index | Code |
|---|---|---|
| `@@unique([suiteId, name])` | `test_case_suiteId_name_key` | `name-taken` |
| `@@unique([suiteId, automationKey])` | `test_case_suiteId_automationKey_key` | `automation-key-taken` |
| Any other unique index, for example `test_case_version_testCaseId_version_key` when two approvals publish to the same case at once | varies | `publish-conflict` |

When a constraint fails, the transaction rolls back, so the proposal stays `in_review`. Retrying the same approval fails the same way until the data changes.

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
| An official case gets the same `automationKey` after the proposal was written (ingestion or another approval) | automationKey | No: ingestion and approval both reclassify the suite, which sets the target | Unlikely to persist |
| The proposal has no `suiteId`, so approval falls back to the default suite, which the reclassifier never visits | automationKey | Yes | Edge case |
| Two approvals publish a version to the same case at the same time | other (`publish-conflict`) | No | Race |

Which constraint fired for the September 2026 production reports (`cmulizy510ey40lqzlzdouhnk`, `cmulizy4s0ey20lqzuo9padfx`, `cmulizy4j0ey00lqzo8hukcmp`, `cmum2xnkw008d0lmti0qmjkhk`) is unverified. The new log line answers it the next time a reviewer hits the conflict.

## Follow-ups

None of these is implemented. This slice only makes the 409 precise; it does not give the reviewer a way to resolve it.

| Owner | Work | Contract | Status |
|---|---|---|---|
| Web | Handle `automation-key-taken` and `publish-conflict` in `apps/web/src/features/review-inbox/lib/decision-error.ts`. Both fall back to the generic `error` today | `code` as above | Not implemented |
| Web | Show `conflictingCase.name` and link to the case so the reviewer can compare before rejecting | `conflictingCase: { id, name, suiteId } \| null` | Not implemented |
| Web | After `automation-key-taken`, refetch the proposal: it should come back as an update once the reclassify job runs | Existing proposal detail endpoint | Not implemented |
| API and web | Give reviewers a way out of `name-taken` besides rejecting: an optional title override on approve, validated like extraction titles (1 to 120 characters) | Proposed: `POST /review/proposals/:id/approve` body `{ comment?: string, title?: string }` | Not implemented. The approve body accepts no `title` today |
| API and web | Let the reviewer resolve `name-taken` or `automation-key-taken` by publishing the proposal as a new version of `conflictingCase`, as an explicit human choice made after seeing that case | Not designed | Not implemented |
| API | Include proposals with a null `suiteId` in reclassification, or backfill their suite | None | Not implemented |
