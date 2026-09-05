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

For every reported case, Qably looks up the resolved suite's `TestCase` rows (of any state) by exact,
case-sensitive name match. A match sets `RunCase.testCaseId`. A name with no match is adopted — see
"Suite adoption" above — as a new `draft` `TestCase`, which is then linked the same way, so
`RunCase.testCaseId` is never left `null` because a name was simply unrecognized; it links to a draft
from the very first report. This is what lets a suite's test cases reflect the latest execution
automatically, without a human updating them by hand, and without an AI writing the case for them
either — the case exists, unofficially, until a human promotes it. The full snapshot (`name`, `steps`,
`expectedResult`) is still stored on `RunCase` even when linked — that is deliberate audit evidence of
what was actually reported, not redundant with the official test case, which can itself change after
the run.

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

### Response

`200 OK` with `{ "runs": [ <RunView>, ... ] }` — an array, not a single run, because one request can
create several runs (see below). Each element has the same shape as the `POST /runs/ingest` response
body. The array preserves the order suites first appeared in the XML.

### One run per `<testsuite>`

A JUnit file commonly holds many `<testsuite>` elements — jest-junit and vitest's junit reporter
both emit one per test *file*, not one per run — and Qably's model ties a suite 1:1 to a source file
(approved product rule 6: "la suite ingestada se nombra por archivo"). Collapsing every `<testsuite>`
in a report into one run would collapse that per-file suite structure along with it, so the endpoint
does not do that:

- **The parser reads the whole file in one pass** (`apps/api/src/modules/runs/lib/parse-junit-xml.ts`),
  recursing into nested `<testsuite>` elements exactly as described below.
- **A second, pure step groups the parsed cases by their own `<testsuite>` name**
  (`apps/api/src/modules/runs/lib/group-junit-report.ts`, `groupJunitReportBySuite`), preserving the
  order each suite name first appears in the file.
- **The controller calls `POST /runs/ingest`'s own ingestion once per group, sequentially** — each
  group becomes its own run, its own suite resolution/adoption, and its own transaction. A three-file
  vitest report produces three runs, three suites (adopted or resolved independently), and the
  response's `runs` array has three entries.
- **`externalId` per run**: when the report groups into exactly one suite, the run's `externalId` is
  the query's `externalId` **unchanged** — a single-suite report behaves exactly as it did before this
  split existed, so an already-running idempotent report keeps upserting the same run. When it groups
  into several, each run's `externalId` is `${externalId}-${slug(suiteName)}-${sha256(suiteName)[0:8]}`
  (slug lowercased, non-`[a-z0-9]` runs collapsed to `-`, trimmed, capped at 60 characters — the same
  scheme `scripts/qably-report.mjs` used before this change, now computed server-side).
- **A report grouping into more than 500 distinct suite names is rejected** rather than creating an
  unbounded number of runs from one request.

**Exception — pinning `suiteId` or `suiteName` turns the split off.** An explicit `suiteId` or
`suiteName` is the caller stating "everything in this report belongs to this one suite" — that intent
overrides the file-per-suite default. In that case the endpoint creates exactly **one** run, with
every `<testcase>` from every `<testsuite>` in the file as its cases, `externalId` unchanged, and
`name` defaulting to the XML root's own `name` attribute (the `<testsuites>` or top-level `<testsuite>`
name) rather than any individual per-file suite name.

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
than 10,000 cases, or grouping into more than 500 distinct suites) fail the request.

### `scripts/qably-report.mjs`

The script that reports CI results to Qably (invoked once per generated JUnit file, see
`docs/CI.md`) posts the file's raw contents to this endpoint in a single request — it holds no XML
parsing or per-suite splitting logic of its own; that all happens server-side, as described above.
One file becomes one `POST /runs/ingest/junit` call, which in turn becomes one run per `<testsuite>`
in that file. `suiteName` is left unset so the server derives and splits by it; the script only
supplies `externalId` (built from the job, the run and the file path — see `docs/CI.md`; the server
then re-derives a per-suite `externalId` from this base when the file holds more than one suite),
`source`, `name` (the workflow and job name) and the commit metadata already read from `$GITHUB_SHA`
and `git log`. On success the script reads the `runs` array from the JSON response to log how many
runs were created and their ids. The existing `429` retry/backoff and `::warning` annotation
behavior is unchanged.

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
