# CI — GitHub Actions

`.github/workflows/ci.yml` runs on every push to `main` and on every pull request targeting
`main`. It has two independent jobs, `api` and `web`, running in parallel on `ubuntu-latest`.

## What each job does

Both jobs follow the same shape: checkout, install with a frozen lockfile, then type-check, lint,
build and test.

### `api`

1. `pnpm --filter @qably/api run type-check` — `tsc --noEmit`.
2. `pnpm --filter @qably/api run lint` — eslint.
3. `pnpm --filter @qably/api run build` — `nest build`.
4. `pnpm --filter @qably/api run test` — unit tests (jest, `src/**/*.spec.ts`).
5. `pnpm --filter @qably/api run test:e2e` — e2e tests (jest, `test/**/*.e2e-spec.ts`).
6. Report unit and e2e results to Qably (see below), regardless of whether the tests passed.
7. Upload the JUnit XML files as a workflow artifact.

The `api` job needs no database, no Redis and no other external service. Every e2e spec
overrides `PrismaService` with `jest.fn()` mocks via `Test.createTestingModule().overrideProvider`,
and the one spec that boots `IngestionModule` (which registers a BullMQ queue) also overrides the
queue token (`getQueueToken(INGESTION_QUEUE)`) with a mock. The suite finishes in a few seconds
precisely because nothing ever opens a socket to a real Postgres or Redis instance — confirmed by
reading every `*.e2e-spec.ts` file under `apps/api/test/`. No `services:` block was added to this
job for that reason; adding one would start infrastructure the tests never touch.

Nothing in the `api` job needs environment variables to boot. `ConfigModule` (which validates
`process.env` against the zod schema in `apps/api/src/config/env.ts`) is only pulled in by
`AppModule` and `IngestionModule`. No unit spec imports either module, and every e2e spec that does
import `ConfigModule` overrides the `ENV` provider with an inline dummy `Env` object before the
Nest testing module compiles. `nest build` is a pure TypeScript compile and never touches
`process.env` either.

### `web`

1. `pnpm --filter @qably/web run type-check` — `tsc --noEmit`.
2. `pnpm --filter @qably/web run lint` — eslint.
3. `pnpm --filter @qably/web run build` — `next build`.
4. `pnpm --filter @qably/web run test:run` — vitest (`vitest run`).
5. Report results to Qably, regardless of whether the tests passed.
6. Upload the JUnit XML file as a workflow artifact.

`apps/web/next.config.ts` calls `resolveApiBaseUrl()` at module-load time, which throws if
`NEXT_PUBLIC_API_URL` is unset or not a URL — this runs during `next build`. The `web` job sets
`NEXT_PUBLIC_API_URL: http://localhost:3001` at the job level so `build` boots. This is a dummy
value; it is never actually dialed, since the build never makes a real request. `vitest.config.ts`
already sets its own `NEXT_PUBLIC_API_URL` for the test environment, so the two do not conflict.

### `type-check`

Both apps' `package.json` gained a `"type-check": "tsc --noEmit"` script as part of this change —
`turbo.json` already declared a `type-check` task, but neither app defined the script it was
supposed to run, so it was a phantom task before this workflow.

## Local worker caps are not used in CI

`--maxWorkers=4` and `--pool=threads` (jest and vitest, respectively) exist locally so the laptop
running them doesn't overheat. GitHub-hosted runners are dedicated, disposable machines with no
such constraint, so CI intentionally omits both flags and lets each tool pick its own default
parallelism. The local `test`, `test:run` and `test:e2e` scripts in `package.json` are unchanged —
CI passes the JUnit reporter flags as extra CLI arguments on top of the existing scripts, it does
not redefine them.

## JUnit reporters

- **api** (jest): `jest-junit` is a devDependency. CI runs
  `jest --reporters=default --reporters=jest-junit` with `JEST_JUNIT_OUTPUT_DIR` and
  `JEST_JUNIT_OUTPUT_NAME` set per step, so unit and e2e runs write to
  `apps/api/reports/junit-unit.xml` and `apps/api/reports/junit-e2e.xml` respectively. Nothing in
  `package.json`'s `jest` config was changed — the reporter is opt-in, passed only in the workflow.
- **web** (vitest): `vitest run --reporter=default --reporter=junit --outputFile=./reports/junit.xml`
  writes `apps/web/reports/junit.xml`. `--outputFile` is vitest's documented flag for redirecting a
  `json`, `html` or `junit` reporter's output to a file.

Both XML files are uploaded via `actions/upload-artifact` so a failed run is diagnosable without
re-running anything.

## Reporting results to Qably

After the tests run (successful or not — the step uses `if: always()`), each job invokes
`scripts/qably-report.mjs` once per generated JUnit file:

```
node scripts/qably-report.mjs apps/api/reports/junit-unit.xml
node scripts/qably-report.mjs apps/api/reports/junit-e2e.xml
node scripts/qably-report.mjs apps/web/reports/junit.xml
```

The script reads `QABLY_API_KEY` (a GitHub Actions **secret**) from the environment. **If it is
unset, the script logs a message and exits 0 without doing anything.** This is deliberate: the
Qably API is not deployed yet — `https://api.qably.dev` resolves through Cloudflare to Railway but
answers Railway's own `{"status":"error","code":404,"message":"Application not found"}`, because
the project has only a Postgres and a Redis service. There is nowhere to POST to today, and the
workflow must stay green until that changes.

The API origin defaults to `https://api.qably.dev` (`DEFAULT_API_BASE_URL` in the script).
`QABLY_API_BASE_URL` overrides it and is **optional**: it exists for local runs
(`http://localhost:3001`) and for a self-hosted deployment. A team wiring Qably into their own CI
supplies a key and nothing else — the tool knows its own address, the same way Codecov or Sentry
do. The project-scoped API key already identifies the organization and project, so the origin
carries no information the key does not.

### Rate limits and retries

`POST /runs/ingest` is throttled at **30 requests per minute per credential**
(`runs.controller.ts`), and the throttler buckets by API key rather than by IP, so every job in a
workflow run shares one budget. The script posts **one request per `<testsuite>`**, so a repository
with more than 30 suites will exhaust the window partway through a run.

When the API answers `429`, the script waits and retries instead of dropping the suite. It honours
the `Retry-After` header the throttler sends (in seconds); when that header is missing it falls
back to exponential backoff starting at 10s, capped at 90s per wait, for up to
`MAX_THROTTLE_RETRIES` retries. A suite is only reported as failed once every retry is exhausted.

The trade-off is wall-clock time: a run with many suites can spend minutes waiting for throttle
windows to reopen. That is deliberate — losing results silently is worse than a slower reporting
step. If this becomes painful, the fix is a batch endpoint that accepts a whole run in one request,
not a higher limit.

### Enabling it

Once the API is deployed and reachable:

1. Issue a project-scoped API key from the project's **API Keys** screen (`POST
   /projects/:projectId/api-keys` under the hood — see `docs/API_KEYS.md`).
2. In the GitHub repository settings, add:
   - **Settings → Secrets and variables → Actions → Secrets** — `QABLY_API_KEY`, the plaintext key
     (`qbly_<lookupId>_<secret>`).
   - Only if the reporter must target something other than the default origin,
     **Settings → Secrets and variables → Actions → Variables** — `QABLY_API_BASE_URL`, an origin
     with no trailing slash and no path.
3. The very next workflow run starts reporting — no code change needed.

The key is never committed. The workflow reads it exclusively from `secrets.*`, and the optional
override from `vars.*`.

## JUnit → `POST /runs/ingest` mapping

For each `<testsuite>` element found in a JUnit file, the script builds and sends one
`POST /runs/ingest` payload (see `docs/RUN_INGESTION.md` for the full contract):

| JUnit | Payload field |
| --- | --- |
| `<testsuite name="...">` | `suiteName` |
| `<testcase name="...">` | `cases[].name` |
| `<testcase>` containing a `<failure>` or `<error>` child | `cases[].status: 'fail'` |
| `<testcase>` containing a `<skipped>` child | `cases[].status: 'skip'` |
| `<testcase>` with none of the above | `cases[].status: 'pass'` |
| — | `source: 'github_actions'` (fixed) |
| `<testsuite timestamp="...">` | `startedAt` (offset added if the timestamp has none) |
| `timestamp + time` (seconds) | `finishedAt` |
| `$GITHUB_SHA` | `commitSha` |
| `git log -1 --pretty=%s` / `%an` (best-effort, read locally — cheaper than parsing the event
  payload) | `commitMessage` / `commitAuthor` |

JUnit has no status equivalent to Qably's `blocked` case status, so the script never produces it —
inventing one would misrepresent what the test runner actually reported.

A JUnit file commonly contains many `<testsuite>` elements (jest-junit and vitest's junit reporter
both emit one per test *file*, not one per run), and `POST /runs/ingest` accepts exactly one suite
per request. The script therefore posts one run per `<testsuite>`, sequentially, and keeps going
even if one of them fails.

### `externalId` scheme

```
gha-<GITHUB_RUN_ID>-<GITHUB_JOB>-<slug(suiteName)>-<sha256(suiteName)[0:8]>
```

- **`GITHUB_RUN_ID`** — identifies one workflow run. Deliberately **not** combined with
  `GITHUB_RUN_ATTEMPT`: re-running a failed job (a GitHub Actions "re-run failed jobs") keeps the
  same `GITHUB_RUN_ID`, so a re-run replays the same `externalId` and upserts the existing run
  instead of creating a duplicate — which is exactly the idempotency behavior described in
  `docs/RUN_INGESTION.md`. A genuinely new workflow run (new push, new PR sync) gets a new run ID
  and therefore a new `externalId` per suite.
- **`GITHUB_JOB`** — disambiguates suites with the same name reported from different jobs in the
  same run (`api` vs `web`).
- **`slug(suiteName)`** — the suite name lowercased and reduced to `[a-z0-9-]`, kept for
  readability in logs and dashboards.
- **`sha256(suiteName)[0:8]`** — an 8-hex-character digest of the *unslugged* suite name, appended
  so that two different suite names that happen to slugify to the same string still get distinct
  `externalId`s.

## Suite adoption on first report

`scripts/qably-report.mjs` always sends `suiteName` (the JUnit `<testsuite name="...">` value, see the
mapping table below), never `suiteId`. `POST /runs/ingest` used to answer `404` whenever `suiteName`
didn't already match an existing suite, which meant **the first real report for any suite name always
404'd** until a human pre-created a suite with the exact name jest-junit or vitest assigned it. That is
no longer true: an unrecognized `suiteName` is now adopted — the suite is created on the spot, along
with a `draft` `TestCase` for every reported case name — and the report succeeds with `200` on its very
first attempt. See `docs/RUN_INGESTION.md`'s "Suite adoption" section for the full behavior, including
why drafts are not immediately official (§4.3.4 rule b) and how a human promotes one.

`scripts/qably-report.mjs` still detects a `404` specifically and prints a `::warning::` annotation
instead of a raw HTTP error dump — that path now means an explicit `suiteId` didn't resolve, which
this script never sends, or a genuinely revoked/misconfigured key, not the "unknown suite" case it used
to mean.

### Does a failed report fail the CI job?

**No.** `scripts/qably-report.mjs` never calls `process.exit(1)`; every failure path (missing
secrets, a `404`, any other non-2xx response, a network error) is caught, logged as a
`::warning::` annotation, and counted in the final `N succeeded, M failed` summary line. The job's
actual pass/fail signal comes entirely from the test step itself (`jest` / `vitest` exiting
non-zero on a real test failure) — reporting to Qably is a best-effort side channel, not a gate. This
stays true even now that first reports succeed: a Qably-side outage or a revoked key is Qably's
problem, not the pull request's. Blocking merges on the availability of an external, optional
integration is the wrong failure mode — the uploaded JUnit artifact is still there for a human to
inspect either way.

## Limitations

- The XML parser in `scripts/qably-report.mjs` is a small, purpose-built regex parser, not a
  general-purpose XML parser. It assumes the flat `<testsuites><testsuite><testcase>` shape that
  jest-junit and vitest's junit reporter both produce; it does not handle nested `<testsuite>`
  elements.
- No new runtime dependency was added for XML parsing — the format jest-junit and vitest emit is
  narrow and stable enough that a small hand-written parser is a better trade-off than a general
  XML library for a single internal script.
- The script posts one request per suite. Against a deployed API this hits the `/runs/ingest`
  throttle on any repository with more than 30 suites; the `429` retry path above keeps the results
  from being lost, but the real fix is a batch endpoint. See **Rate limits and retries**.
- The success, `404`, `429` and network-error paths were validated locally against real JUnit files
  (generated from `apps/api`'s and `apps/web`'s own test suites) posted to a throwaway local HTTP
  server.
