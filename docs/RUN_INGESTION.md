# Run Ingestion — Reporting Execution Results from an External Agent

`POST /runs/ingest` and `POST /runs/ingest/junit` are how an external CI agent (GitHub Actions
today, any CI runner tomorrow) reports the outcome of a test execution back to Qably. See
`docs/API_KEYS.md` for how the credential used here is issued, stored and scoped.

This is the mechanism behind Limit 4 (§1.6.2): Qably never runs tests itself, it only receives and
records results produced elsewhere.

**`POST /runs/ingest/junit` is the recommended path for any CI agent that already produces a JUnit
XML report** (jest-junit, vitest's junit reporter, surefire, pytest, Playwright, GoogleTest, …): it
posts the raw file, and the server parses it — the caller carries no XML parsing logic. See
"JUnit ingestion" below. `POST /runs/ingest` stays available for callers that already hold a
structured payload with no XML to parse.

## Authentication

```
Authorization: Bearer qbly_<lookupId>_<secret>
```

The endpoint is guarded by `ApiKeyGuard` only — there is no session, no organization header, and no
`projectId` in the body. The project and organization are derived entirely from the key. This route is
marked `@Public()` to bypass the global session guard, exactly like `POST /webhooks/scm/:provider`.

Rejections:

- No `Authorization` header, a malformed token, or a token that fails the hash comparison → `401`.
- A revoked key → `401`.

## Request body

```json
{
  "externalId": "gh-run-482913",
  "source": "github_actions",
  "suiteId": "suite_123",
  "name": "Checkout regression — main",
  "startedAt": "2026-09-01T10:00:00Z",
  "finishedAt": "2026-09-01T10:04:12Z",
  "commitSha": "a1b2c3d",
  "commitMessage": "fix: checkout rounding",
  "commitAuthor": "Ada Lovelace",
  "cases": [
    {
      "name": "Adds an item to the cart",
      "status": "pass"
    },
    {
      "name": "Applies a discount code",
      "steps": ["open cart", "apply code SAVE10"],
      "expectedResult": "total is reduced by 10%",
      "status": "fail"
    }
  ]
}
```

| Field                | Required | Notes                                                              |
| --------------------- | -------- | ------------------------------------------------------------------- |
| `externalId`          | yes      | Non-empty. The idempotency key — see below.                         |
| `source`               | no       | `api` (default) or `github_actions`. `manual` is rejected: manual runs come from the session-authenticated UI, never from a key. |
| `suiteId` / `suiteName` | exactly one | Resolved against the key's project. Case-sensitive exact match by name. `suiteId` never creates a suite; `suiteName` adopts one on a miss — see "Suite adoption" below. |
| `name`                | yes      | The run's display name.                                             |
| `startedAt` / `finishedAt` | no  | ISO 8601 datetimes.                                                  |
| `commitSha` / `commitMessage` / `commitAuthor` | no | Free-form commit metadata.                          |
| `cases`               | yes      | At least one. Each case needs `name` and `status`; `steps`, `expectedResult`, `suiteName` and `recordedAt` are optional. |

A case's `suiteName` defaults to the resolved suite's name when omitted — it exists so a case reported
under a different label (for example a Playwright project name) still keeps that label as audit
evidence without affecting suite resolution.

Each case also accepts the following optional, bounded fields — populated automatically by
`POST /runs/ingest/junit` from the parsed report, or settable directly on `POST /runs/ingest`:

| Field            | Max length | Notes                                                                 |
| ---------------- | ---------- | ---------------------------------------------------------------------- |
| `className`      | 250        | JUnit `classname` attribute — the file path or fully qualified class the reporter attached to the case. |
| `filePath`       | 500        | JUnit `file` attribute, where the reporter provides one (pytest, Playwright). |
| `durationMs`     | —          | Non-negative integer. JUnit `time` (seconds) converted to whole milliseconds. Omitted when the reporter provides no numeric `time`. |
| `failureType`    | 250        | The `type` attribute on a `<failure>` or `<error>` element.           |
| `failureMessage` | 1000       | The `message` attribute on a `<failure>` or `<error>` element.        |
| `failureDetails` | 4000       | The text body of a `<failure>` or `<error>` element (stack trace or assertion diff). |
| `skipReason`     | 500        | The `message` attribute, or text body, of a `<skipped>` element.      |

All seven are optional and independent — a case can report any subset of them. They exist purely as
audit detail on `RunCase`; nothing in test case linking or run status derivation reads them.

## Suite adoption

`suiteId` and `suiteName` behave differently on a miss, and that difference is deliberate:

- **`suiteId` that does not resolve → `404`.** An explicit ID is a claim about something that should
  already exist. If it does not, that is a client error — the endpoint never creates a suite from an
  ID.
- **`suiteName` that does not resolve → adopted.** The suite is created on the spot (scoped to the
  key's project, named exactly as reported) and the report proceeds as if it had always existed. This
  is what lets the very first CI report for a new project succeed instead of 404ing — see the "Known
  limitation" section that used to live in `docs/CI.md`, which this closes.
- **A known suite with case names that have no matching `TestCase` → those names are adopted too.**
  Every reported case name is resolved against the suite's existing `TestCase` rows by exact name; any
  name with no match gets a new `TestCase` created for it. This is the ongoing value, not just a
  first-run fix: a test added in the repository shows up in Qably automatically on its next CI report,
  with no human and no AI in the loop.

Every case created this way is created with **`state: 'draft'`** — never `active`. This is not a
detail, it is the product's backbone (§4.3.4 rule b): *"Ningún caso de prueba generado por inteligencia
artificial se considera parte oficial del conjunto de pruebas mientras no exista una confirmación
humana explícita."* A case discovered from a CI report was not written by a human inside Qably any more
than one written by an AI was — both need the same explicit human confirmation before they count as
part of the official test set. A draft case exists (so the run can still link to it, see below) but is
excluded from anything that represents the official suite — see "Draft cases are not official" below.

A human promotes a draft with `PATCH /suites/:id/cases/:caseId`, sending `{ "state": "active" }` — the
same endpoint already used to edit any other case field, documented in `docs/RUN_QUERIES.md`'s sibling,
the suites module. No separate promotion endpoint exists: promoting is just another case update.

Nothing adopted this way is ever deleted or deprecated automatically. A case that stops appearing in
later reports is left exactly as it is — draft or active — until a human acts on it.

Suite and case adoption are idempotent: `TestCase` has `@@unique([suiteId, name])`, and adoption uses
`skipDuplicates` against it, so replaying the same report (or two reports racing each other) never
creates a second draft for the same name. `Suite` already has `@@unique([projectId, name])`, which is
what makes name-based suite resolution — and adoption — safe in the first place; a create that loses a
race against that constraint falls back to reading the row the other request just created.

## Draft cases are not official

A `draft` `TestCase` is real — it can be linked from `RunCase.testCaseId`, it appears in
`GET /suites` and `GET /suites/:id` so a human can review and promote it — but it must never be counted
as part of the official test set. The one place in the API where "official test set" was previously
computed without a state filter was `POST /runs` (starting a manual run from the session-authenticated
UI, documented in `docs/RUN_QUERIES.md`): the run's case snapshot, and the "a suite with zero cases
cannot run" check, now consider only `state: 'active'` cases. A suite that has cases but all of them are
still `draft` is treated as empty for that endpoint, the same as a suite with no cases at all — this is
a real behavior change to `POST /runs`'s numbers for any suite that has draft cases, not a cosmetic one.

Every other place that counts or lists runs and cases — suite listing (`GET /suites`), project activity,
and the dashboard summary — was checked and found to already operate on `RunCase.status` (what actually
executed) rather than `TestCase.state`, so none of them needed a change: a reported result is a fact
about what ran, independent of whether the case it links to has been promoted yet.

## Status derivation

`Run.status` is never trusted from the client — it is derived server-side from the reported case
statuses, in this precedence:

1. Any case is `fail` → the run is `fail`.
2. Otherwise, any case is still `pending` or `running` → the run is `running`.
3. Otherwise, every case is `pass`, `skip` or `blocked`. If at least one is `pass` or `skip` → the run
   is `pass`. If every case is `blocked` → the run is `fail`, because a run in which nothing could
   actually be verified is not a passing run.

Each `RunCase.status`, by contrast, is exactly what the agent reported — that is the whole point of
the endpoint.

## Test case linking

`RunsService.ensureOfficialCases` loads every `TestCase` row of the resolved suite once (regardless of
state or execution mode) and resolves each reported case against it in memory — it no longer filters the
match in SQL. Two lookups run in parallel, both keyed by `normalizeAutomationKeyForMatch`
(`apps/api/src/modules/runs/lib/normalize-automation-key.ts`): official `automationKey`, and — only for a
row whose `automationKey` is still `null` and whose `executionMode` is `automated` — the case `name` as a
legacy fallback. `normalizeAutomationKeyForMatch` builds on the review module's
`normalizeAutomationKey` (trims, collapses whitespace, treats `" > "` and a plain space as the same
join — vitest emits the former, jest-junit the latter) and additionally lowercases it, so a key that
only changed reporter or casing still resolves to the same official case; the review module itself stays
case-preserving on purpose, since proposal deduplication there treats a case difference as a real
difference. A legacy name match backfills `automationKey` onto that row, same as before.

A match whose `automationFilePath` or `automationClassName` is still `null` is backfilled from the
parsed ref's `filePath`/`className` when the report carries them — a later, richer CI report can fill in
what an earlier one left blank. An already-set field is never overwritten by a later report. All
backfills for a run are batched into one `testCase.update` per row (merging a legacy key backfill and a
file/class backfill together when both apply) inside the ingest transaction.

A key with no match at all is adopted — see "Suite adoption" above — as a new `draft` `TestCase`, which
is then linked the same way, so `RunCase.testCaseId` is never left `null` because a key was simply
unrecognized; it links to a draft from the very first report. This is what lets a suite's test cases
reflect the latest execution automatically, without a human updating them by hand, and without an AI
writing the case for them either — the case exists, unofficially, until a human promotes it. The full
snapshot (`name`, `steps`, `expectedResult`) is still stored on `RunCase` even when linked — that is
deliberate audit evidence of what was actually reported, not redundant with the official test case,
which can itself change after the run.

### Case identity — `classname` + `name`

A reported case's identity — the key `ensureOfficialCases` matches and creates against — is not always
its raw `name`. When the report carries a `className` that is not (up to truncation) the same string as
`name` or a prefix of it, the identity becomes the composite `${className}::${name}`
(`apps/api/src/modules/runs/lib/case-identity.ts`, `resolveCaseIdentityKey`). This is what lets pytest
and Maven surefire reports — where `classname` is a separate, meaningful package/module path
(`tests.checkout.test_checkout`) and `name` alone (`test_add_item`) is ambiguous across files — create
one official case per file, not one shared case for every file that happens to have a
`test_add_item`. jest-junit and vitest, which already report `classname` equal to (or a prefix of)
`name`, are unaffected: the identity stays the plain `name`, exactly as before this changed. The prefix
comparison is truncation-aware — `name` truncates at 120 characters and `classname` at 250, so a title
over 120 characters where both fields were originally identical is still recognized as the same case,
not misread as a composite.

**Legacy rows are durably migrated on an unambiguous claim.** Matching tries the composite identity
first, then falls back to the legacy (name-only) key — the same two-step migration pattern
`Suite.ingestionKey` already uses. When that fallback finds a pre-composite row (one whose
`automationKey` is still the bare name), it now rewrites `automationKey` to the composite the same
transaction, exactly like `Suite.ingestionKey` gets stamped on first match: a later report for the
same test claims the row by its own composite key directly, and the row can never be silently handed
to a different test that happens to share the same bare name (see the next paragraph). This migration
only happens when the fallback is unambiguous — see below.

**Two identities that both reach the same legacy row is a collision, not a coin flip.** A composite
identity's fallback to a pre-composite row, and a plain (no-`className`) identity's own key, both
resolve through the row's bare-name `automationKey`. If more than one distinct identity reported in
the same batch shares that bare name — a plain case and a composite case, or two composites with
different `className`s — `findLegacyKeyCollisions`
(`apps/api/src/modules/runs/lib/case-identity.ts`) catches it before any of them touches that row:
none of them claims it or backfills its key. A composite identity in that situation still gets its own
new draft case under its own distinct composite key (safe — it cannot collide with the contested bare
name); a plain identity does not get drafted at all, because drafting under the exact bare name would
just silently re-claim whichever row already holds it.

**This is not the same collision set as `caseIdentityCollisions`, and it is not surfaced today.**
`findLegacyKeyCollisions` runs only inside `RunsService.ensureOfficialCases`, which executes inside
the ingest transaction on the worker (`RunIngestProcessor`) — after `POST /runs/ingest/junit` has
already answered `202`. The response's `caseIdentityCollisions` field (see "Response" above) is
`findCaseIdentityCollisions` output computed synchronously in the controller, before any job is
enqueued, and it never includes a legacy-key collision: that check has nothing to read from yet at
that point, since it needs the suite's existing `TestCase` rows, which only load inside the worker's
transaction. A legacy-key collision is therefore silently unlinked with no signal to the caller at
all today — no `202` field, no `::warning::` annotation, no log line. Making this visible needs the
same design work as the paragraph below ("Collisions are not persisted"): a later `/review-inbox` SDD
should decide how a legacy-key collision is surfaced, alongside the in-batch collisions
`caseIdentityCollisions` already reports.

The migration itself is race-safe independently of whether a collision was reported: on a `P2002`
from the migrating `testCase.update` (a concurrent ingest already claimed the same composite
`automationKey` on a different row), the transaction rolls back to a savepoint, re-reads the row that
actually owns that key in the suite, and links this run's result to that row instead — the legacy row
being migrated is left untouched rather than silently keeping a stale link. See
`RunsService.migrateAutomationKeys`.

**Collisions are never merged silently.** If two differently-reported cases (different `name`,
different `className`, or both) resolve to the identical identity key within the same suite,
`findCaseIdentityCollisions` catches it before either one touches the database: neither is matched
to an existing official case, neither creates a new one, and both keep `RunCase.testCaseId: null`
rather than one silently overwriting or absorbing the other. `POST /runs/ingest/junit` also runs the
same check per suite group before enqueuing, and lists any collision in the response's
`caseIdentityCollisions` (see "Response" above) — the group itself is still accepted and queued, only
the colliding cases are left unlinked until a human renames one of them.

**Collisions are not persisted.** `caseIdentityCollisions` and the legacy-key collisions above exist
only in the `202` response and the CI reporter's `::warning::` annotations — nothing is written to the
`Run` row or any other table. A collision a human never sees (a local run, a CI log nobody reads) is
silently forgotten once the response is gone. Making this durable needs its own design, not a field
bolted on here: a later `/review-inbox` SDD should decide where collisions live (a column on `Run`
versus a dedicated table — a dedicated table reads better once collisions need their own list/filter/
resolve lifecycle independent of any one run), whether ambiguous legacy rows created a real orphaned
`TestCase` that also needs surfacing (see the paragraph above — the contested legacy row itself is
left untouched, not linked to anything, which is a distinct fact from "these two identities collided"),
and how a human resolution (renaming a test, deleting a stale draft) retroactively closes the
collisions it caused.

## Idempotency

Replaying the same `(projectId, source, externalId)` does not create a second run. The endpoint
upserts on that compound key:

- **Case set** — always fully replaced: the previous cases are deleted and the payload's cases are
  recreated in payload order (`position` follows array index), never appended.
- **`name`, `suiteId`/suite resolution, and the derived `status`** — always overwritten with the
  latest report's values.
- **Optional metadata** (`startedAt`, `finishedAt`, `commitSha`, `commitMessage`, `commitAuthor`) —
  overwritten only when the replay actually supplies them. A lightweight replay that omits commit
  metadata does not erase metadata a previous, richer report already stored.

The whole write — suite adoption, the test case lookup and draft creation, the run upsert, the case
delete, and the case recreate — happens inside a single `prisma.$transaction`, so a replay (or a first
report that adopts a suite) is never observed half-applied.

`executedById` is always `null` for api-key ingests; only the session-authenticated UI can attribute a
run to a user.

## Response

`200 OK` with the persisted run and its cases, ordered by `position`, for both the first report and
every replay. `200` rather than `201` is deliberate: from the caller's point of view this is an
idempotent report, not a resource-creation call — the same request can be sent many times and the
status code should not depend on whether Qably happened to already have a row for it.

```json
{
  "id": "run_abc123",
  "projectId": "project_123",
  "organizationId": "org_123",
  "suiteId": "suite_123",
  "name": "Checkout regression — main",
  "status": "fail",
  "source": "github_actions",
  "externalId": "gh-run-482913",
  "startedAt": "2026-09-01T10:00:00.000Z",
  "finishedAt": "2026-09-01T10:04:12.000Z",
  "commitSha": "a1b2c3d",
  "commitMessage": "fix: checkout rounding",
  "commitAuthor": "Ada Lovelace",
  "cases": [
    {
      "id": "run_case_1",
      "testCaseId": "case_1",
      "name": "Adds an item to the cart",
      "suiteName": "Checkout",
      "steps": [],
      "expectedResult": "",
      "status": "pass",
      "position": 0
    },
    {
      "id": "run_case_2",
      "testCaseId": "case_2",
      "name": "Applies a discount code",
      "suiteName": "Checkout",
      "steps": ["open cart", "apply code SAVE10"],
      "expectedResult": "total is reduced by 10%",
      "status": "fail",
      "position": 1
    }
  ]
}
```

Case adoption applies identically whether the suite was resolved by `suiteId` or by `suiteName` (or
just adopted): every reported case name is matched against the resolved suite's `TestCase` rows, and
any name with no match is drafted and linked. `testCaseId` is therefore never `null` on the output of a
successful `POST /runs/ingest` — the field stays nullable in the type only because `RunCase` also backs
manually-driven runs, and a failed ingest never gets this far.

## JUnit ingestion — `POST /runs/ingest/junit`

The body is the **raw JUnit XML report**, sent as-is — no JSON envelope. Everything that would be a
body field on `POST /runs/ingest` is instead a query parameter, and `cases` is derived entirely from
the XML by the server's own parser (`apps/api/src/modules/runs/lib/parse-junit-xml.ts`); the caller
never parses XML itself.

```
POST /runs/ingest/junit?externalId=gha-482913-api-abcd1234&source=github_actions&name=CI%20%2F%20api%20(%23482913)&commitSha=a1b2c3d
Authorization: Bearer qbly_<lookupId>_<secret>
Content-Type: application/xml

<testsuites name="vitest tests">
  <testsuite name="src/features/checkout/checkout.test.ts">
    <testcase classname="src/features/checkout/checkout.test.ts" name="Checkout > adds an item" time="0.012"/>
  </testsuite>
</testsuites>
```

| Query parameter | Required | Notes                                                                 |
| ---------------- | -------- | ---------------------------------------------------------------------- |
| `externalId`      | yes      | The idempotency key. See "One run per `<testsuite>`" below for how it behaves when a report holds several suites. |
| `source`          | no       | `api` (default) or `github_actions`.                                  |
| `suiteId` / `suiteName` | no | Pins the report to one existing (or adopted) suite and turns off the per-suite split — see below. Passing `suiteId` skips suite-name derivation from the XML entirely. |
| `name`            | no       | Defaults to the run's suite name when omitted (see below for what that is per run). |
| `startedAt` / `finishedAt` / `commitSha` / `commitMessage` / `commitAuthor` | no | Same as `POST /runs/ingest`, applied identically to every run this request creates. |
| `reportSize`      | no       | A positive integer stating how many suite groups the **whole original report** contains, across every chunk of a client-side split (see "One run per `<testsuite>`" below). Omitted (the default) means "this request's own accepted-plus-rejected groups are the whole report" — unchanged behavior for the common, unsplit case. When present it is validated server-side: raised to at least this request's own group count (accepted plus rejected) if still under that, and capped at 100,000 if absurdly large. It is never trusted blindly, and it is never reduced for a rejected group — see "Rejected groups still count toward the batch" below. |

### Response — `202 Accepted`, asynchronous

Unlike `POST /runs/ingest`, this endpoint does not write anything before it responds. Parsing and
grouping the XML happen synchronously in the request (see "One run per `<testsuite>`" below), but the
actual ingestion — suite resolution/adoption, the run upsert, the case delete-and-recreate, the
notification — happens later, on a worker, off the request path:

```json
{
  "accepted": 2,
  "runs": [
    { "externalId": "gha-482913-a1b2c3d4", "suiteName": "src/a.test.ts", "jobId": "project_123:github_actions:gha-482913-a1b2c3d4" },
    { "externalId": "gha-482913-c9d0e1f2", "suiteName": "src/c.test.ts", "jobId": "project_123:github_actions:gha-482913-c9d0e1f2" }
  ],
  "rejected": [
    { "suiteName": "src/b.test.ts", "reason": "suiteName: String must contain at least 1 character(s)" }
  ],
  "caseIdentityCollisions": [
    { "suiteName": "src/a.test.ts", "key": "tests.checkout::test_add_item", "count": 2 }
  ],
  "truncatedFields": { "name": 1 }
}
```

- `accepted` — how many jobs were enqueued (one per accepted suite group).
- `runs[].externalId` — the per-run externalId, exactly as described in "One run per `<testsuite>`"
  below.
- `runs[].suiteName` — the run's suite name, before truncation-driven ambiguity: the first case's
  (truncated) `suiteName` in that group.
- `runs[].jobId` — the queue job id for that run, `${projectId}:${source}:${externalId}` with any
  character outside `[A-Za-z0-9_.:-]` replaced by `-`. It is deterministic: replaying the same
  `(projectId, source, externalId)` produces the same `jobId`, so a duplicate delivery of the same
  report (a GitHub Actions re-run, a network retry) collides with the still-queued or still-processing
  job for that run instead of enqueuing a second one.
- `rejected[].suiteName` / `rejected[].reason` — a group that failed the same `ingestRunSchema`
  validation `POST /runs/ingest` uses, and was therefore never enqueued. `suiteName` falls back to the
  group's externalId when the suite name itself is what's empty or invalid. See "Rejected groups still
  count toward the batch" below for what happens to a rejected group when the report is split across
  several requests.
- `caseIdentityCollisions[]` — see "Case identity" below. A collision never rejects the suite; the
  colliding cases still ingest as `RunCase` rows, just with `testCaseId: null`.
- `truncatedFields` — a count per field name of how many values were clipped to their length limit
  while parsing this request's XML (see the "Request body" table above for each limit). Never a
  rejection reason on its own.

**Validation happens synchronously, per suite group, not all-or-nothing.** Every group's ingest
payload is built and validated with the same schema `POST /runs/ingest` uses (`ingestRunSchema`)
*before* anything is enqueued. A group that fails validation is skipped — its `suiteName` and reason
go into the `rejected` array — while every other, valid group in the same report is still enqueued
normally. The response is still `202`, never `400`, for a per-group validation failure; a caller
reconciles partial acceptance by reading `rejected`, not by retrying the whole report. Only a
structural problem in the XML itself (invalid XML, no `<testcase>` anywhere, nesting past 32 levels,
more than 10,000 cases, or grouping into more than 500 distinct suites — see "What the parser reads"
below) still answers `400` and enqueues nothing, because there is no group to build a per-suite result
from in the first place.

**The run is not necessarily visible the instant the request returns.** `202` means "accepted for
processing", not "processed". A worker (`RunIngestProcessor`, `apps/api/src/modules/runs/run-ingest.processor.ts`)
picks up each queued job and calls the same `RunsService.ingest` that backs `POST /runs/ingest`. Under
normal load this happens within milliseconds of the response, but a caller that needs to read the run
back immediately (rather than eventually, via `GET /runs` or the dashboard) should poll rather than
assume it exists synchronously.

**Retries and failure modes**, per job:

- A **business rejection** — `suite-not-found` (an explicit `suiteId` that does not resolve) or
  `source-not-allowed` (a `source` other than `api` or `github_actions`) — is not retried. The worker
  throws BullMQ's `UnrecoverableError` for these; retrying the exact same payload would fail identically
  every time, so retrying would only delay the (still-necessary) `Logger` line recording the failure.
- Anything else — a Prisma/Postgres error, a Redis hiccup, an unexpected exception — is treated as
  infrastructure trouble and retried automatically: **3 attempts, exponential backoff starting at 1s**
  (BullMQ's `defaultJobOptions` on the `run-ingest` queue). A job that still fails after 3 attempts is
  kept (`removeOnFail: 500` — the last 500 failed jobs are retained) for operator inspection; a
  succeeded job is discarded immediately (`removeOnComplete: true`).
- The worker logs one line per job outcome (project id, externalId, outcome) — never the payload, since
  case names, failure messages and stack traces are user/CI-controlled content that does not belong in
  application logs.

### One run per `<testsuite>`

A JUnit file commonly holds many `<testsuite>` elements — jest-junit and vitest's junit reporter
both emit one per test *file*, not one per run — and Qably's model ties a suite 1:1 to a source file
(approved product rule 6: "la suite ingestada se nombra por archivo"). Collapsing every `<testsuite>`
in a report into one run would collapse that per-file suite structure along with it, so the endpoint
does not do that:

- **The parser reads the whole file in one pass** (`apps/api/src/modules/runs/lib/parse-junit-xml.ts`),
  recursing into nested `<testsuite>` elements exactly as described below. Each parsed case carries
  both a `suiteName` (truncated to 120 characters, the value that ends up on `RunCase.suiteName` and in
  the response above) and a `suiteKey` — the same value, **untruncated**, up to 500 characters.
- **A second, pure step groups the parsed cases by `suiteKey`, not `suiteName`**
  (`apps/api/src/modules/runs/lib/group-junit-report.ts`, `groupJunitReportBySuite`), preserving the
  order each key first appears in the file. Grouping by the untruncated key means two suites whose
  names happen to share their first 120 characters — and would therefore collapse into the same
  `suiteName` — still stay in separate groups, separate runs, and separate suites. A group's own
  `suiteName` is the (truncated) `suiteName` of the first case seen in that group.
- **Two `<testsuite>` elements with the exact same full name merge into one group.** This is intended,
  not a bug: two nodes named identically describe the same source file (or the same logical suite,
  for a reporter that legitimately splits one file's cases across sibling `<testsuite>` elements), and
  Qably's suite-per-file model has no way to tell those two nodes apart — nor should it try to; a
  single suite with all of that name's cases is the correct, unambiguous outcome.
- **The controller calls `POST /runs/ingest`'s own ingestion once per group, asynchronously** — see
  "Response — `202 Accepted`, asynchronous" above. Each group becomes its own queued job, its own run,
  its own suite resolution/adoption, and its own transaction, all independent of the others. A
  three-file vitest report enqueues three jobs, three suites (adopted or resolved independently), and
  the response's `runs` array has three entries.
- **`externalId` per run**: when the report groups into exactly one suite, the run's `externalId` is
  the query's `externalId` **unchanged** — a single-suite report behaves exactly as it did before this
  split existed, so an already-running idempotent report keeps upserting the same run. When it groups
  into several, each run's `externalId` is `${externalId}-${slug(suiteKey)}-${sha256(suiteKey)[0:8]}`
  (slug lowercased, non-`[a-z0-9]` runs collapsed to `-`, trimmed, capped at 60 characters, both derived
  from the untruncated `suiteKey` so two long suite names that only differ past character 120 still get
  distinct externalIds).
- **A report grouping into more than 500 distinct suite keys is rejected** rather than creating an
  unbounded number of runs from one request.
- **The report-batch notification counts the whole original report, not just one request's groups.**
  A file the reporter has split into several `POST /runs/ingest/junit` chunks (see
  `apps/api/src/reporter/qably-report.mjs` below) still owes exactly one aggregated notification for
  the whole file, once every suite across every chunk has reported in. The batch size Redis tracks
  (`ReportBatchService`, `report-batch.lua.ts`) is `reportSize` from the query when present — the
  reporter sends the same total suite-group count on every chunk of a split file — and falls back to
  `groups.length` (this request's own count) when absent, which is exactly right for an unsplit file
  where one request already is the whole report. The locked size is not fixed forever: if a later
  call for the same batch key reports a larger size than the one currently locked, the batch grows to
  match instead of completing early — a safety net against any one call undercounting the true total.
- **Rejected groups still count toward the batch.** A group that fails validation (see "Response" above)
  is recorded into the same Redis batch as a `rejected` result, the same way an accepted group's `pass`/
  `fail` outcome is, as soon as the controller rejects it — not just dropped from the size. This is what
  makes the batch complete correctly when the rejecting group is not in the first chunk to arrive: before
  this, `reportSize` was reduced by that request's own rejected-group count, but the batch's locked size
  had already been set by whichever chunk arrived first, so a reject in a *later* chunk was invisible to
  it and the batch only ever closed via the 120-second timeout, publishing a partial notification. The
  aggregated notification lists rejected suite names the same way it lists failed ones
  (`rejectedCount`/`rejectedSuiteNames` alongside `failedCount`/`failedSuiteNames` in the payload,
  `build-batch-notification.ts`), and counts as `run_failed` whenever there is at least one rejection,
  even with zero test failures.

**Exception — pinning `suiteId` or `suiteName` turns the split off.** An explicit `suiteId` or
`suiteName` is the caller stating "everything in this report belongs to this one suite" — that intent
overrides the file-per-suite default. In that case the endpoint enqueues exactly **one** job, with
every `<testcase>` from every `<testsuite>` in the file as its cases, `externalId` unchanged, and
`name` defaulting to the XML root's own `name` attribute (the `<testsuites>` or top-level `<testsuite>`
name) rather than any individual per-file suite name.

**The run's `name` fallback**, applied per group before validation: the query's own `name` when given;
otherwise the group's `suiteName` when it is non-empty; otherwise the query's `externalId`. The last
step only matters in the pathological case of a group whose `suiteName` ends up empty — in practice
the parser always derives a non-empty suite name, so this is a defensive fallback, not a common path.

### What the parser reads

- Every `<testsuite>`, recursively (surefire and similar reporters nest `<testsuite>` inside
  `<testsuite>`), up to 32 levels deep — a report nesting past that is rejected as malformed rather
  than silently truncated.
- Per `<testcase>`: `name` (falls back to `classname` when absent), `classname` → `className`,
  `file` → `filePath`, `time` (seconds) → `durationMs` (whole milliseconds).
- A `<failure>` or `<error>` child → `status: 'fail'` plus `failureType`, `failureMessage` and
  `failureDetails` (the element's text body).
- A `<skipped>` child → `status: 'skip'` plus `skipReason` (its `message` attribute, or its text
  body when no attribute is present).
- `<system-out>`, `<system-err>` and `<properties>` are never read.

A report is capped at 10,000 `<testcase>` elements; beyond that the request is rejected rather than
processed partially. The request body itself is capped at 10 MB (`main.ts`). Every string field
above is truncated to the limit in the table in "Request body", never rejected for being long — only
structural problems (invalid XML, no `<testcase>` elements anywhere, nesting past 32 levels, more
than 10,000 cases, or grouping into more than 500 distinct suites) fail the request. Every truncation
across the whole parsed report is counted per field name and returned as `truncatedFields` in the
`202` body (see "Response" above) — a value being clipped is never silent, even though it never
rejects anything on its own.

### Security limits

`fast-xml-parser` 5 **does** substitute entities declared in a `<!DOCTYPE>` block — it is not immune
to a classic "billion laughs" entity-expansion attack by default. The protection here is not "the
parser ignores DOCTYPE"; it is the parser's own `processEntities` limits, configured explicitly in
`parse-junit-xml.ts`:

| Limit | Value | Stops |
| --- | --- | --- |
| `maxEntitySize` | 1,000 | A single declared entity's raw definition from being enormous. |
| `maxEntityCount` | 50 | A document declaring an unbounded number of entities. |
| `maxExpansionDepth` | 20 | Entities that reference entities that reference entities, nested past a shallow, legitimate depth. |
| `maxTotalExpansions` | 100 | The total number of substitutions performed across the whole document. |
| `maxExpandedLength` | 100,000 | The final expanded string size, even if every individual limit above was respected. |

A payload that would exceed any of these is rejected by the parser itself, before Qably's own
application-level limits ever see it. Those application-level limits are the second, independent
layer:

- **10 MB** request body cap (`main.ts`), before the XML is even handed to the parser.
- **32** levels of `<testsuite>` nesting (`MAX_TESTSUITE_DEPTH`).
- **10,000** `<testcase>` elements per report (`MAX_TESTCASES`).
- **500** distinct suite groups per report (`MAX_GROUPS`, in `group-junit-report.ts`).

None of these five is a substitute for the others — `processEntities` stops entity-expansion memory
blowups specifically, the 10 MB cap stops a merely large document, and the depth/count/group caps
stop a well-formed-but-adversarially-shaped document from producing unbounded work downstream (one
`Run` per group, one `RunCase` per case) even though it parsed cleanly.

### Integration fixture

`apps/api/test/fixtures/junit-e2e.xml` is a real jest-junit report captured from apps/api's own e2e
suite, used by `apps/api/test/junit-e2e-fixture.e2e-spec.ts` to exercise the full ingestion path (the
`/runs/ingest/junit` endpoint through to `RunsService.ingest`) against realistic structure instead of a
hand-written snippet. To regenerate it: run
`JEST_JUNIT_OUTPUT_DIR=./reports JEST_JUNIT_OUTPUT_NAME=junit-e2e.xml JEST_JUNIT_ADD_FILE_ATTRIBUTE=true npx jest --config ./test/jest-e2e.json --ci --reporters=default --reporters=jest-junit --maxWorkers=2`
from `apps/api`, then rewrite every `<testcase>`'s `file` attribute the same way
`apps/api/src/reporter/qably-report.mjs`'s `repoRelativeFilePaths` does for CI (`apps/api`-relative, forward
slashes), strip the `timestamp` attribute from each `<testsuite>` and replace any `<failure>` body with
a short, stable placeholder — the goal is a fixture whose suite/case/file structure is real and
reproducible, not one whose diff churns on machine paths, wall-clock timestamps or a stack trace tied to
this run's line numbers.

### `apps/api/src/reporter/qably-report.mjs`

The reporter (a zero-dependency ES module, also served at `GET /report.mjs` — see `docs/CI.md`)
posts each file's raw contents to this endpoint in one request per file — it holds no full JUnit
parsing logic of its own; per-suite splitting and case identity all happen server-side, as
described above. The one exception is sizing: the reporter does the minimal parsing needed to
count testcases and top-level `<testsuite>` elements, and if a file would exceed this endpoint's
own caps (10,000 testcases or 500 groups, see above) it splits that one file into multiple requests
along `<testsuite>` boundaries before sending, never inside a suite. Every chunk of a split file
carries the same `reportSize` query parameter — the total top-level `<testsuite>` count of the
*whole* original file, computed once before splitting (`countTopLevelGroups` in
`qably-report.mjs`, which ports the server's own `suiteKey` grouping rule — see below) — so the
server can aggregate one notification for the whole report instead of one per chunk (see above). In
the common case, one file becomes one `POST /runs/ingest/junit` call,
which in turn becomes one enqueued job per `<testsuite>` in that file. `suiteName` is left unset so
the server derives and splits by it; the reporter only supplies `externalId` (built from the job,
the run and the file path — see `docs/CI.md`; the server then re-derives a per-suite `externalId`
from this base when the file holds more than one suite), `source`, and the commit metadata already
read from `$GITHUB_SHA` and `git log` — there is no `name` parameter, the server derives each run's
name from the suite it actually parsed. On success the reporter reads `accepted` and the `runs`
array's `externalId`s from the `202` JSON response to log how many jobs were queued and for which
runs — it does not (and cannot) know whether ingestion itself has finished by the time it logs. The
`429`/`5xx`/network retry-with-backoff and `::warning`/`::notice` annotation behavior is unchanged
in spirit; reporting failures never fail the CI job unless `QABLY_FAIL_ON_ERROR=true` is set (see
`docs/CI.md`). Each outbound attempt is also bounded by a request timeout (`AbortSignal.timeout`,
60s by default, overridable with `QABLY_REPORT_TIMEOUT_MS`) — a hanging server is treated as a
retryable network error exactly like a connection failure, instead of blocking the CI job
indefinitely. Since unit 10 the reporter also reads `rejected`, `caseIdentityCollisions` and
`truncatedFields` off the same `202` body and prints one `::warning::` per rejected group and per
case identity collision, and one `::notice::` per request that truncated at least one field — see
`docs/CI.md` for the exact wording and the `QABLY_FAIL_ON_ERROR` interaction.

**`countTopLevelGroups` ports the server's exact grouping rule, it does not approximate it.** The
earlier implementation only looked at top-level `<testsuite>` blocks directly under `<testsuites>`,
matching the server's `groupJunitReportBySuite` in the common flat-structure case but undercounting
whenever a block nested a further, differently-named `<testsuite>` — the server splits that into two
distinct groups, the client used to see one top-level block and report `reportSize: 1` for it. It now
walks the whole document recursively, mirroring `parse-junit-xml.ts`'s `collectCases` and
`group-junit-report.ts`'s `groupJunitReportBySuite` directly: a `<testsuite>` with its own `name`
attribute starts a new suite key at any depth, one without inherits its closest ancestor's key, and
two nodes anywhere in the document that resolve to the identical key merge into one group — the same
Map-by-suiteKey-value semantics the server uses, including the "two identically-named `<testsuite>`
nodes merge into one group" rule. This still does not require a full XML parser: the walk reuses the
same tag-depth-tracking primitive `findTopLevelTestsuiteBlocks` already used for splitting
(`splitChildTestsuiteBlocks` in `qably-report.mjs`), generalized to recurse into any fragment instead
of only the `<testsuites>` root body, and to also work when the root is a bare `<testsuite>` rather
than `<testsuites>`. A contract test (`qably-report.spec.ts`, `countTopLevelGroups`) runs the client
function and the server's own `groupJunitReportBySuite` over the same fixtures — flat multi-suite,
pytest-style classname nesting two levels deep, a surefire-style unnamed nested testsuite, and the
identically-named-merge case — and asserts the counts always match, not just the one shape that used
to diverge.

**Defense in depth if a future XML shape still disagrees.** `ReportBatchService`'s Redis-backed batch
size is no longer fixed by whichever call reaches it first: `report-batch.lua.ts`'s
`RECORD_SUITE_RESULT_SCRIPT` now grows the locked `size` to the max of what it already has and what
the current call reports, instead of `HSETNX`-locking it once. If some XML shape the contract test
above does not yet cover still makes the client undercount, the batch grows to match the largest
total any call for that key actually reported, rather than completing early and publishing a partial
notification.

**A bare `<testsuite>` root that is oversized has no `<testsuite>` boundary to split on** (see
`buildSplitRequests` above: `oversizedUnsplittable: true`) and is sent as a single, over-cap request,
annotated with a warning rather than refused client-side — the server still enforces its own caps and
answers `400` if the request truly cannot be processed. Splitting a single oversized `<testsuite>`
by testcase, instead of by suite boundary, was considered and rejected for this unit: it would need
the server to merge several partial-case uploads into one run (the current ingest transaction always
replaces a run's full case set, `runCase.deleteMany` then recreate — see "Idempotency" above), which
is a server-side change, not a reporter one, and out of scope here.

## SCM ingestion queue retry policy

The webhook-driven ingestion path (`POST /webhooks/scm/:provider`, handled by `IngestionService` and
queued on the `ingestion` BullMQ queue, `apps/api/src/modules/ingestion/ingestion.module.ts`) shares
the same retry philosophy as `run-ingest` above but is configured independently, since the two queues
process unrelated work (repository code-change ingestion vs. test run reporting):

- **3 attempts, exponential backoff starting at 5s** (`INGESTION_QUEUE_DEFAULT_JOB_OPTIONS`,
  `apps/api/src/modules/ingestion/ingestion.tokens.ts`) before a job is left failed.
- **Up to 100 completed jobs are retained** (`removeOnComplete: 100`) for a short operational window,
  rather than discarded immediately — useful for spot-checking recent webhook deliveries.
- **Up to 500 failed jobs are retained** (`removeOnFail: 500`) for operator inspection, the same bound
  used by `run-ingest` and `extraction`.

These are the queue's `defaultJobOptions`; an individual `queue.add` call can still override any of
them for a specific job (for example the deterministic `jobId` used for webhook idempotency), but no
call currently needs to.

## curl example

```bash
curl --fail --silent \
  --header "Authorization: Bearer $QABLY_API_KEY" \
  --header "Content-Type: application/json" \
  --data '{
    "externalId": "gh-run-482913",
    "source": "github_actions",
    "suiteId": "suite_123",
    "name": "Checkout regression — main",
    "cases": [
      { "name": "Adds an item to the cart", "status": "pass" }
    ]
  }' \
  https://api.qably.app/runs/ingest
```

```bash
curl --fail --silent \
  --header "Authorization: Bearer $QABLY_API_KEY" \
  --header "Content-Type: application/xml" \
  --data-binary @reports/junit.xml \
  "https://api.qably.app/runs/ingest/junit?externalId=gh-run-482913&source=github_actions"
```
