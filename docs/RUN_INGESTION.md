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
| `suiteId` / `suiteName` | exactly one | Resolved against the key's project. Case-sensitive exact match by name. Never creates a suite. |
| `name`                | yes      | The run's display name.                                             |
| `startedAt` / `finishedAt` | no  | ISO 8601 datetimes.                                                  |
| `commitSha` / `commitMessage` / `commitAuthor` | no | Free-form commit metadata.                          |
| `cases`               | yes      | At least one. Each case needs `name` and `status`; `steps`, `expectedResult`, `suiteName` and `recordedAt` are optional. |

A case's `suiteName` defaults to the resolved suite's name when omitted — it exists so a case reported
under a different label (for example a Playwright project name) still keeps that label as audit
evidence without affecting suite resolution.

If neither `suiteId` nor `suiteName` resolves to a suite that belongs to the key's project, the
response is `404`. The endpoint never creates a suite implicitly from an external payload — an
untrusted payload must never be able to expand what exists in a project, only report against what
already does.

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

For every reported case, Qably looks up the resolved suite's official `TestCase` rows by exact,
case-sensitive name match. A match sets `RunCase.testCaseId`; no match leaves it `null`. This is what
lets a suite's test cases reflect the latest execution automatically, without a human updating them by
hand. The full snapshot (`name`, `steps`, `expectedResult`) is still stored on `RunCase` even when
linked — that is deliberate audit evidence of what was actually reported, not redundant with the
official test case, which can itself change after the run.

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

The whole write — suite's official cases lookup, the run upsert, the case delete, and the case
recreate — happens inside a single `prisma.$transaction`, so a replay is never observed half-applied.

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
      "testCaseId": null,
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
