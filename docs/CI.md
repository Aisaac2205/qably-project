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

### The response is `202`, not `200` — reporting is asynchronous

`POST /runs/ingest/junit` answers `202 Accepted` with `{ "accepted": <count>, "runs": [{ "externalId",
"suiteName", "jobId" }, ...] }` — see `docs/RUN_INGESTION.md`'s "Response — `202 Accepted`,
asynchronous" for the full contract. The script logs `accepted` and each entry's `externalId` from
that body; it does not, and cannot, know whether the run each `jobId` refers to has actually been
written by the time the script exits, because ingestion happens on a worker after the HTTP response
is sent. This is not a regression from an older synchronous contract — it is a deliberate design so
that a slow ingestion (suite adoption, case linking) never adds latency to the CI job that is
reporting it.

### Rate limits and retries

`POST /runs/ingest/junit` is throttled at **30 requests per minute per credential**
(`runs.controller.ts`), and the throttler buckets by API key rather than by IP, so every job in a
workflow run shares one budget. The script posts **one request per JUnit file**, regardless of how
many `<testsuite>` elements it contains or how many runs the server creates from it — see
`docs/RUN_INGESTION.md`'s "One run per `<testsuite>`" for why splitting moved server-side. A
workflow with, say, three report files (unit, e2e, web) spends three requests against the budget no
matter how many suites are inside them.

When the API answers `429`, the script waits and retries instead of dropping the file. It honours
the `Retry-After` header the throttler sends (in seconds); when that header is missing it falls
back to exponential backoff starting at 10s, capped at 90s per wait, for up to
`MAX_THROTTLE_RETRIES` retries. A file is only reported as failed once every retry is exhausted.

Because one request already carries a whole file — the server splits it into runs internally, not
the script — this budget is now sized against **the number of report files a workflow generates**
(typically one to three), not the number of `<testsuite>` elements inside them. A repository would
need more than 30 report files reported in the same minute to exhaust the window, which no job in
this workflow comes close to. The retry path above exists for that edge case and for genuine
transient throttling, not because chattiness is expected day to day.

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

## JUnit ingestion — `POST /runs/ingest/junit`

`scripts/qably-report.mjs` posts each generated JUnit file's **raw XML contents** as the request
body, in a single `POST /runs/ingest/junit` call per file — it holds no XML parsing logic of its own.
Everything that would be a JSON payload field is instead a query parameter the script builds from
the environment:

| Query parameter | Built from |
| --- | --- |
| `source` | fixed `github_actions` |
| `externalId` | `gha-<GITHUB_RUN_ID>-<GITHUB_JOB>-<slug(basename(filePath))>-<sha256(filePath)[0:8]>` — see below |
| `name` | `<GITHUB_WORKFLOW> / <GITHUB_JOB> (#<GITHUB_RUN_NUMBER>)` |
| `commitSha` | `$GITHUB_SHA` |
| `commitMessage` / `commitAuthor` | `git log -1 --pretty=%s` / `%an` (best-effort, read locally — cheaper than parsing the event payload) |

The server does all the parsing: reading every `<testsuite>` and `<testcase>` (including nested
suites), deriving each case's status from a `<failure>`/`<error>`/`<skipped>` child, and — critically
— **splitting one file into one run per `<testsuite>`** it contains. See `docs/RUN_INGESTION.md`'s
"One run per `<testsuite>`" section for the full mapping table and the splitting rules; this file
does not duplicate it. JUnit has no status equivalent to Qably's `blocked` case status, so the
server never produces it — inventing one would misrepresent what the test runner actually reported.

### `externalId` scheme

```
gha-<GITHUB_RUN_ID>-<GITHUB_JOB>-<slug(basename(filePath))>-<sha256(filePath)[0:8]>
```

This is the script's own, **per-file** `externalId`, passed as a query parameter. When the file
holds more than one `<testsuite>`, the server derives a further per-suite `externalId` from this
base (`<base>-<slug(suiteName)>-<sha256(suiteName)[0:8]>`) for each run it creates — see
`docs/RUN_INGESTION.md`. The script itself never computes a suite-level id; it does not parse the
file, so it does not know the suite names.

- **`GITHUB_RUN_ID`** — identifies one workflow run. Deliberately **not** combined with
  `GITHUB_RUN_ATTEMPT`: re-running a failed job (a GitHub Actions "re-run failed jobs") keeps the
  same `GITHUB_RUN_ID`, so a re-run replays the same `externalId` and upserts the existing run(s)
  instead of creating duplicates — which is exactly the idempotency behavior described in
  `docs/RUN_INGESTION.md`. A genuinely new workflow run (new push, new PR sync) gets a new run ID.
- **`GITHUB_JOB`** — disambiguates report files with the same name reported from different jobs in
  the same run (`api` vs `web`).
- **`slug(basename(filePath))`** — the file's own name lowercased and reduced to `[a-z0-9-]`, kept
  for readability in logs and dashboards.
- **`sha256(filePath)[0:8]`** — an 8-hex-character digest of the full (unslugged) file path, appended
  so that two files whose basenames happen to slugify to the same string still get distinct
  `externalId`s.

## Suite adoption on first report

`scripts/qably-report.mjs` never sends `suiteId` or `suiteName` — it lets the server derive and
split suites from the XML entirely, per `docs/RUN_INGESTION.md`. An unrecognized suite name is
adopted once the worker processes the corresponding queued job — the suite is created, along with a
`draft` `TestCase` for every reported case name — and the report is accepted with `202` on its very
first attempt for every suite the file contains, without waiting for that adoption to happen. See
`docs/RUN_INGESTION.md`'s "Suite adoption" and "Response — `202 Accepted`, asynchronous" sections for
the full behavior, including why drafts are not immediately official (§4.3.4 rule b) and how a human
promotes one.

### Does a failed report fail the CI job?

**No.** `scripts/qably-report.mjs` never calls `process.exit(1)`; every failure path (missing
secrets, any non-2xx response, a network error) is caught, logged as a `::warning::` annotation, and
counted in a `1 succeeded` / `1 failed` summary line per file. The job's actual pass/fail signal
comes entirely from the test step itself (`jest` / `vitest` exiting non-zero on a real test failure)
— reporting to Qably is a best-effort side channel, not a gate. A Qably-side outage or a revoked key
is Qably's problem, not the pull request's. Blocking merges on the availability of an external,
optional integration is the wrong failure mode — the uploaded JUnit artifact is still there for a
human to inspect either way.
