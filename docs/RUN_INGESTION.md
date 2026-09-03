# Run Ingestion — Reporting Execution Results from an External Agent

`POST /runs/ingest` is how an external CI agent (GitHub Actions today, any CI runner tomorrow)
reports the outcome of a test execution back to Qably. See `docs/API_KEYS.md` for how the credential
used here is issued, stored and scoped.

This is the mechanism behind Limit 4 (§1.6.2): Qably never runs tests itself, it only receives and
records results produced elsewhere.

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
