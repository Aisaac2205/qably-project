# CI — GitHub Actions

`.github/workflows/ci.yml` runs on every push to `main`, on every pull request targeting `main`
and on manual dispatch (`workflow_dispatch`). A newer run on the same ref cancels the one in
progress (`concurrency` with `cancel-in-progress`). It has three independent jobs, `api`, `web` and
`landing`, running in parallel on `ubuntu-latest` with Node 22.

## What each job does

All three jobs follow the same shape: checkout, install with a frozen lockfile, build the
workspace packages the app imports, check the app, run its tests, report the results and upload
the JUnit file.

### `api`

1. `pnpm --filter @qably/types --filter @qably/i18n --filter @qably/test-naming run build` — the
   workspace packages the API imports.
2. Type-check and test `@qably/types` and `@qably/test-naming`.
3. `pnpm --filter @qably/api exec prisma generate` — the Prisma client.
4. `pnpm --filter @qably/api run type-check` — `tsc --noEmit`.
5. `pnpm --filter @qably/api run lint` — eslint.
6. `pnpm --filter @qably/api run build` — `prisma generate && nest build`.
7. `diff apps/api/dist/src/reporter/qably-report.mjs apps/api/src/reporter/qably-report.mjs` — fails
   the job if the built reporter asset (served at `GET /report.mjs`, see below) is missing or stale,
   instead of letting a broken `nest-cli.json` asset copy ship silently and only surface as a 503 in
   production.
8. `pnpm --filter @qably/api run test:ci` — unit tests (jest, `src/**/*.spec.ts`) with the JUnit
   reporter.
9. `pnpm --filter @qably/api run test:e2e:ci` — e2e tests (jest, `test/**/*.e2e-spec.ts`) with the
   JUnit reporter.
10. Report unit and e2e results to Qably (see below), regardless of whether the tests passed.
11. Upload the JUnit XML files as the `api-junit-reports` workflow artifact (kept 14 days).

The `api` job needs no database, no Redis and no other external service. The e2e specs replace
`PrismaService` with `jest.fn()` mocks through `Test.createTestingModule().overrideProvider`. The
specs that compile modules with queues or Redis clients replace those too: `stubQueues` in
`apps/api/test/support/stub-queues.ts` overrides the five BullMQ queue tokens, their processors and
the Redis clients (`AI_DAILY_BUDGET_REDIS`, `REPORT_BATCH_REDIS`) with mocks. The suites finish
quickly because nothing opens a socket to a real Postgres or Redis instance. No `services:` block
is declared for that reason; adding one would start infrastructure the tests never touch.

Nothing in the `api` job needs environment variables to boot. `ConfigModule` validates
`process.env` against the zod schema in `apps/api/src/config/env.ts`. No unit spec imports it or
`AppModule`, and every e2e spec that loads `ConfigModule` overrides the `ENV` provider with the
shared `testEnv` object in `apps/api/test/support/test-env.ts` before the Nest testing module
compiles. `nest build` is a pure TypeScript compile and never touches `process.env` either.

### `web`

1. Build the workspace packages (`@qably/types`, `@qably/i18n`, `@qably/test-naming`).
2. Type-check and test `@qably/test-naming`.
3. `pnpm --filter @qably/web run type-check` — `tsc --noEmit`.
4. `pnpm --filter @qably/web run lint` — eslint.
5. `pnpm --filter @qably/web run build` — `next build`.
6. `pnpm --filter @qably/web run test:ci` — vitest (`vitest run --maxWorkers=2`).
7. Report results to Qably, regardless of whether the tests passed.
8. Upload the JUnit XML file as the `web-junit-report` workflow artifact (kept 14 days).

`apps/web/next.config.ts` calls `resolveApiBaseUrl()` at module-load time, which throws if
`NEXT_PUBLIC_API_URL` is unset or not a URL — this runs during `next build`. The `web` job sets
`NEXT_PUBLIC_API_URL: http://localhost:3001` at the job level so `build` boots. This is a dummy
value; it is never actually dialed, since the build never makes a real request. `vitest.config.ts`
already sets its own `NEXT_PUBLIC_API_URL` for the test environment, so the two do not conflict.

`NEXT_PUBLIC_DOCS_URL` is optional and names the origin of the public documentation site, so the app
can link a QA from the empty Actions tab of the runs page to the CI reporting guide. Unset, the
link is a same-origin path (`/docs#...`, `/en/docs#...`), which is right for local development
where the two apps are proxied together. Production should set the real docs origin; no value is
guessed here because domains are the owner's call.

### `landing`

1. `pnpm --filter @qably/types run build`.
2. `pnpm --filter @qably/landing run type-check` — `astro sync && tsc --noEmit`.
3. `pnpm --filter @qably/landing run test:ci` — vitest (`vitest run --maxWorkers=2
   --no-file-parallelism`).
4. Report results to Qably, regardless of whether the tests passed.
5. Upload the JUnit XML file as the `landing-junit-report` workflow artifact (kept 14 days).
6. `pnpm --filter @qably/landing run build` — `astro build`.

The job sets `PUBLIC_SITE_URL`, `PUBLIC_WEB_URL` and `PUBLIC_API_URL` from repository variables of
the same names, each with a default in the workflow, so the Astro build resolves its public URLs.
The landing page has no lint step.

### `type-check`

Every app defines a `type-check` script (`tsc --noEmit`; `astro sync && tsc --noEmit` for the
landing app), and `turbo.json`'s `type-check` task runs it after building the dependencies.

## Test scripts and worker caps

CI runs the dedicated `:ci` scripts, which are the local scripts plus the JUnit reporter. The
`apps/api` scripts embed no worker cap, so the api unit and e2e suites run with jest's default
parallelism on the runner. The `test:run` and `test:ci` scripts of `apps/web` embed
`--maxWorkers=2`, and the landing ones embed `--maxWorkers=2 --no-file-parallelism`, so CI runs
those two suites with the same caps as a local run. The caps exist so a laptop running the suites
doesn't overheat. See `docs/TESTING.md` for the local commands.

## JUnit reporters

- **api** (jest): `jest-junit` is a devDependency. The `test:ci` and `test:e2e:ci` scripts run
  `jest --ci --reporters=default --reporters=jest-junit`, with `JEST_JUNIT_OUTPUT_DIR` and
  `JEST_JUNIT_OUTPUT_NAME` set per step in the workflow, so unit and e2e runs write to
  `apps/api/reports/junit-unit.xml` and `apps/api/reports/junit-e2e.xml` respectively. The `jest`
  config in `package.json` does not declare the reporter, so the plain `test` and `test:e2e`
  scripts do not produce XML.
- **web** and **landing** (vitest): the JUnit reporter is declared in each `vitest.config.ts`,
  gated on `CI`, writing `reports/junit.xml` under the app. It lives in the config because the
  one option that matters below is a reporter option with no CLI flag, and a `--reporter` on the
  command line replaces whatever the config declares.

The XML files are uploaded via `actions/upload-artifact` so a failed run is diagnosable without
re-running anything.

### The `file` attribute is what lets Aeris read a test

A case created from a JUnit report only knows which source file it lives in when the report says
so: the parser reads `<testcase file="...">` into `automationFilePath`, and that path is what the
extractor fetches from the repository when someone asks Aeris to document the case. Without it the
case is skipped with `no-source-file`, and the fallback that recovers a path from an earlier
repository change only works for files the SCM webhook has already seen.

Both reporters also name a case differently. vitest writes `Describe > it title`; jest-junit on its
default templates writes `Describe it title`, joined by a single space. Qably stores the name as the
report gives it and matches Aeris output tolerant of that difference, so neither reporter needs a
custom `titleTemplate`.

Both reporters omit the attribute by default. `jest-junit` turns it on with
`JEST_JUNIT_ADD_FILE_ATTRIBUTE=true` (set per step in the workflow); vitest's reporter takes
`addFileAttribute: true` in the config. Connecting the repository is not a substitute: results and
code changes are two independent pipelines, and only the report can say where a case came from.

Both reporters emit the path relative to the app they ran in (`src/...`), while the repository, the
webhook and the extractor all speak in repository-relative paths (`apps/web/src/...`). A path
without the workspace prefix would resolve to nothing on the provider. The reporter (served by the
API at `GET /report.mjs`, source at `apps/api/src/reporter/qably-report.mjs`) rewrites every `file`
attribute before sending, prefixing the workspace it derives from the report's
own location (`<workspace>/reports/<file>.xml`), so no reporter option has to know about the
monorepo layout. `QABLY_REPO_PATH_PREFIX` overrides the derived prefix for layouts that do not
follow that convention, and an empty value disables the rewrite. The rewrite is idempotent: a path
that already carries the prefix is left alone.

Turning this on fixes cases created from then on. A case that already exists keeps its empty path,
because the path is written once, when the case is first created.

## Reporting results to Qably

The reporter is a single self-contained, zero-dependency ES module,
`apps/api/src/reporter/qably-report.mjs`, and it is also served straight from the API at
`GET /report.mjs` (`Content-Type: text/javascript`, `Cache-Control`, `ETag`,
`X-Qably-Report-Version`, and `X-Qably-Report-Sha256` so a caller can pin and verify the exact
bytes before running them — see `docs/RUN_INGESTION.md`). A third-party CI wires it in with one
line:

```
curl -fsSL https://api.qably.dev/report.mjs -o qably-report.mjs && node qably-report.mjs ./reports
```

This repository's own CI does **not** do that download-and-run — it invokes the checked-out
source directly instead, `if: always()`, once per generated JUnit file:

```
node apps/api/src/reporter/qably-report.mjs apps/api/reports/junit-unit.xml
node apps/api/src/reporter/qably-report.mjs apps/api/reports/junit-e2e.xml
node apps/api/src/reporter/qably-report.mjs apps/web/reports/junit.xml
node apps/api/src/reporter/qably-report.mjs apps/landing/reports/junit.xml
```

This is a deliberate deviation from the "download the served script" pattern: fetching and
executing code from a URL controlled by a mutable `vars.QABLY_API_BASE_URL`, in a job that also
holds `secrets.QABLY_API_KEY` in its environment, hands code execution with that secret to
whoever controls the origin or the variable, and it would mean CI tests the *deployed* script
instead of the commit's. Running the source in the repo keeps the reporter itself covered by this
same job's own `Unit tests` step (`apps/api/src/reporter/qably-report.spec.ts`), which exercises
retries, splitting and annotations against a fake server before this step ever runs. The
`GET /report.mjs` endpoint is still exercised on every CI run, by
`apps/api/test/report.e2e-spec.ts`, which asserts it serves the exact same bytes as the checked-out
source file plus a matching `X-Qably-Report-Sha256`.

If the asset fails to load at boot (`ReportController.onModuleInit`, `apps/api/src/reporter/report.controller.ts`)
— a missing file, a bad deploy — the whole API no longer fails to start over it: the failure is
logged and `GET /report.mjs` answers `503` on just that route until it is fixed. `If-None-Match` is
handled per RFC 9110: a comma-separated list of validators, the `*` wildcard, and weak (`W/"..."`)
validators are all honoured, and a `304` response carries only the cache-related headers
(`Cache-Control`, `ETag`), never `Content-Type` or the version/sha headers that only make sense on a
body.

The script reads `QABLY_API_KEY` (a GitHub Actions **secret**) from the environment. **If it is
unset, the script logs a `::warning::` and exits 0 without doing anything**, unless
`QABLY_FAIL_ON_ERROR=true`, in which case it exits `1`. This is deliberate: a workflow in a
repository that has not configured a key stays green.

The API origin defaults to `https://api.qably.dev` (`DEFAULT_API_BASE_URL` in the script).
`QABLY_API_BASE_URL` overrides it and is **optional**: it exists for local runs
(`http://localhost:3001`) and for a self-hosted deployment. A team wiring Qably into their own CI
supplies a key and nothing else — the tool knows its own address, the same way Codecov or Sentry
do. The project-scoped API key already identifies the organization and project, so the origin
carries no information the key does not.

An overridden `QABLY_API_BASE_URL` that is neither `https:` nor `localhost`/`127.0.0.1`/`::1` is
treated as an untrusted origin for the secret: the script logs a `::warning::` (`evaluateBaseUrlSecurity`
in `qably-report.mjs`) and still sends the report, unless `QABLY_FAIL_ON_ERROR=true`, in which case it
refuses to send `QABLY_API_KEY` at all and exits `1` before making any request. This only matters for a
deliberately misconfigured or unusual override — the default and `http://localhost:*` both pass silently.

### Report paths can be files, directories or globs

Every argument that is not a flag is resolved independently (`resolveInputPaths` in
`qably-report.mjs`): a literal file path is used as-is (even if it does not exist yet, so the caller
can warn on the read failure), a glob (`reports/*.xml`) expands to its matches, and a directory is
walked **recursively** for every `*.xml` file it contains, up to 5 levels deep, with symlink loops
guarded against by resolving and deduplicating on `realpath`. An argument that resolves to zero
files — an empty directory, a glob that matches nothing — is annotated with its own `::warning::`
("matched no report files") rather than silently vanishing from the report; a workflow using
`QABLY_FAIL_ON_ERROR=true` fails on that condition like any other reporting failure, and one
argument matching nothing never drops files matched by the *other* arguments in the same
invocation.

### The response is `202`, not `200` — reporting is asynchronous

`POST /runs/ingest/junit` answers `202 Accepted` with `{ "accepted": <count>, "runs": [{ "externalId",
"suiteName", "jobId" }, ...], "rejected": [{ "suiteName", "reason" }, ...], "caseIdentityCollisions":
[{ "suiteName", "key", "count" }, ...], "truncatedFields": { "<field>": <count>, ... } }` — see
`docs/RUN_INGESTION.md`'s "Response — `202 Accepted`, asynchronous" for the full contract. The
script logs the `accepted` count and the number of cases in each file it sent, plus a summary; it
does not, and cannot, know whether the run each `jobId` refers to has actually been written by the
time the script exits, because ingestion happens on a worker after the HTTP response is sent. This
is not a regression from an older synchronous contract — it is a deliberate design so that a slow
ingestion (suite adoption, case linking) never adds latency to the CI job that is reporting it.

Acceptance is per suite group, not all-or-nothing: a report with several `<testsuite>`
elements can have some groups queued and others rejected in the same response — the script prints one
`::warning::` per rejected group (suite name and reason) and one per case identity collision (two
differently-reported cases resolving to the same key — see `docs/RUN_INGESTION.md`'s "Case identity"),
turning the job into a failure only when `QABLY_FAIL_ON_ERROR=true`. A non-empty `truncatedFields`
prints as a single `::notice::` per request — it means some field the server stores was clipped to its
length limit, not that anything was dropped or rejected, so it never fails the job on its own.

### Rate limits and retries

`POST /runs/ingest/junit` is throttled at **30 requests per minute per credential**
(`runs.controller.ts`), and the throttler buckets by API key rather than by IP, so every job in a
workflow run shares one budget. The reporter posts **one request per JUnit file** in the common
case, regardless of how many `<testsuite>` elements it contains or how many runs the server
creates from it — see `docs/RUN_INGESTION.md`'s "One run per `<testsuite>`" for why splitting
moved server-side. A file that exceeds the server's own per-request caps (currently 10,000
testcases or 500 distinct suites — `apps/api/src/modules/runs/lib/parse-junit-xml.ts` and
`group-junit-report.ts`) is the one exception: the reporter splits it client-side along
`<testsuite>` boundaries into the fewest additional requests that fit, never inside a suite. A
workflow with, say, three report files (unit, e2e, web) spends three requests against the budget
no matter how many suites are inside them, unless one of those files is oversized enough to split.

Independently of that, every request also counts against a ceiling of **600 requests per minute per
client address across all routes**, whatever credential it carries. It is sized far above the
per-credential budgets because CI runners often share one egress address. Only a bearer value shaped
like a real API key gets its own per-credential bucket; anything else (a malformed key, another scheme,
no header) is counted against the address.

When the API answers `429` or a `5xx`, or the request itself fails at the network level, the
reporter retries with exponential backoff instead of dropping the file, up to 4 attempts total. A
`429` honours the `Retry-After` header the throttler sends (in seconds) when present. A file is
only reported as failed, via a `::warning::` annotation, once every retry is exhausted; a non-429
`4xx` (a genuinely bad request) is never retried.

Each attempt is bounded by a request timeout (`AbortSignal.timeout`), 60 seconds by default and
overridable with `QABLY_REPORT_TIMEOUT_MS`. A hung connection — the API accepting the socket but
never responding — is treated exactly like a network error: it counts as one of the 4 attempts and
is retried with the same backoff, instead of leaving the CI job blocked indefinitely on a single
stuck request.

### The reporter's grouping count must match the server's

`countTopLevelGroups` in `qably-report.mjs` computes the `reportSize` query parameter — how many
suite groups the whole file will become once the server parses it — by walking the document with the
same suite-key rule the server itself uses (`parse-junit-xml.ts`'s `collectCases`,
`group-junit-report.ts`'s `groupJunitReportBySuite`), not an approximation of it. A mismatch here
would misreport the total to `ReportBatchService`, the Redis-backed batch that decides when every
group of a split file has reported in — see `docs/RUN_INGESTION.md`'s "`apps/api/src/reporter/qably-report.mjs`"
subsection for the full algorithm and the contract test (`qably-report.spec.ts`) that asserts the
client and server counts always agree.

Because one request already carries a whole file — the server splits it into runs internally, not
the script — this budget is now sized against **the number of report files a workflow generates**
(typically one to three), not the number of `<testsuite>` elements inside them. A repository would
need more than 30 report files reported in the same minute to exhaust the window, which no job in
this workflow comes close to. The retry path above exists for that edge case and for genuine
transient throttling, not because chattiness is expected day to day.

### Enabling it

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

`apps/api/src/reporter/qably-report.mjs` posts each generated JUnit file's **raw XML contents** as
the request body, in one `POST /runs/ingest/junit` call per file (or per split chunk for an
oversized file, see above) — the client does only the minimal parsing needed to decide whether a
file must be split, never full JUnit parsing. Everything that would be a JSON payload field is
instead a query parameter the reporter builds from the environment:

| Query parameter | Built from |
| --- | --- |
| `source` | `github_actions` when `GITHUB_ACTIONS` is `true`, otherwise `api` |
| `reportSize` | how many suite groups the whole file becomes on the server (see "The reporter's grouping count must match the server's") |
| `externalId` | `gha-<GITHUB_RUN_ID>-<GITHUB_JOB>-<slug(basename(filePath))>-<sha256(filePath)[0:8]>` — see below |
| `commitSha` | `$GITHUB_SHA` |
| `commitMessage` / `commitAuthor` | `git log -1 --pretty=%s` / `%an` (best-effort, read locally — cheaper than parsing the event payload) |
| `ciRunExternalId` | `$GITHUB_RUN_ID` |
| `ciJobKey` | `$QABLY_JOB_KEY`, otherwise `$GITHUB_JOB` |
| `ciWorkflowName` | `$GITHUB_WORKFLOW` |
| `ciRunNumber` / `ciRunAttempt` | `$GITHUB_RUN_NUMBER` / `$GITHUB_RUN_ATTEMPT` |
| `ciBranch` / `ciHeadRef` | `$GITHUB_REF_NAME` / `$GITHUB_HEAD_REF` |
| `ciActor` / `ciEventName` / `ciRepository` | `$GITHUB_ACTOR` / `$GITHUB_EVENT_NAME` / `$GITHUB_REPOSITORY` |
| `ciServerUrl` | `$GITHUB_SERVER_URL` |

The `ci*` parameters let the server group the per-file reports of one workflow run under one CI run,
which the Actions tab of the runs page lists as one row per push. They are all optional, and
`docs/RUN_INGESTION.md` ("CI run linking") is the reference for them. The facts that matter when
writing a workflow:

- **Limits.** Text values are trimmed and must be 1 to 255 characters; the reporter cuts longer ones at
  255. `ciRunNumber` and `ciRunAttempt` are integers from 1 to 2,147,483,647 (the `int32` range of the
  column); the reporter sends them only when the variable is a plain integer in that range.
  `ciServerUrl` must be an `http` or `https` URL of at most 255 characters; the reporter drops it, and
  does not cut it, when it is not.
- **`ciServerUrl` is normalized.** The server stores only the origin of the URL and discards
  credentials, path, query and fragment, so `https://user:pw@github.com/x?token=abc#frag` is stored as
  `https://github.com`. The origin must still be an `http` or `https` URL of at most 255 characters once
  normalized, so a host name that grows when it is converted to ASCII can be rejected even when the
  value as sent fits. `GITHUB_SERVER_URL` is already an origin, so the reporter's payload is
  unchanged.
- **When they are ignored.** The reporter omits a parameter whose variable is unset, blank or invalid,
  and never fills one from a default, so a run with none of these variables set, such as a local run,
  sends no `ci*` at all. A variable that is set sends its own parameter even outside GitHub Actions:
  with only `QABLY_JOB_KEY` or `GITHUB_JOB` set, the reporter sends `ciJobKey`. The server ignores every
  `ci*` parameter, `ciJobKey` included, when `ciRunExternalId` is absent. A run reported without them
  is not linked to a CI run, so no job of the Actions tab lists it. It does not appear under the Manual tab
  either, which lists only the runs a person started; it stays reachable by its direct link and from the
  suites.
- **`QABLY_JOB_KEY`** is an optional environment variable that replaces `GITHUB_JOB` as `ciJobKey` and,
  in slug form, as the job segment of `externalId`. Set it to a different value for each variant of a
  matrix job so that variants reporting the same file do not overwrite each other. An empty or
  whitespace-only value counts as unset. Adopting it in a workflow that already reports changes the
  `externalId` of that job once; see "Job identity and `QABLY_JOB_KEY`" in `docs/RUN_INGESTION.md`.

There is no `name` query parameter: the reporter leaves the run's display name for the server to
derive from the actual `<testsuite>` it parsed (`resolveRunName` in `runs.controller.ts`), which is
more accurate now that one file can produce several differently-named runs.

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

This is the reporter's own, **per-file** `externalId`, passed as a query parameter. When the file
holds more than one `<testsuite>`, the server derives a further per-suite `externalId` from this
base (`<base>-<slug(suiteName)>-<sha256(suiteName)[0:8]>`) for each run it creates — see
`docs/RUN_INGESTION.md`. The reporter itself never computes a suite-level id for a normal file; it
only appends its own `-p<n>` suffix to the base `externalId` for a split chunk that the server
would otherwise treat as a single, unqualified suite (see "Rate limits and retries" above) — an
edge case that only exists to avoid two different chunks colliding on the server's bare-externalId
fallback.

- **`GITHUB_RUN_ID`** — identifies one workflow run. Deliberately **not** combined with
  `GITHUB_RUN_ATTEMPT`: re-running a failed job (a GitHub Actions "re-run failed jobs") keeps the
  same `GITHUB_RUN_ID`, so a re-run replays the same `externalId` and upserts the existing run(s)
  instead of creating duplicates — which is exactly the idempotency behavior described in
  `docs/RUN_INGESTION.md`. A genuinely new workflow run (new push, new PR sync) gets a new run ID.
- **`GITHUB_JOB`** — disambiguates report files with the same name reported from different jobs in
  the same run (`api` vs `web`). When `QABLY_JOB_KEY` is set and not blank, its slug takes this place
  in the `externalId`.
- **`slug(basename(filePath))`** — the file's own name lowercased and reduced to `[a-z0-9-]`, kept
  for readability in logs and dashboards.
- **`sha256(filePath)[0:8]`** — an 8-hex-character digest of the full (unslugged) file path, appended
  so that two files whose basenames happen to slugify to the same string still get distinct
  `externalId`s.

## Suite adoption on first report

The reporter never sends `suiteId` or `suiteName` — it lets the server derive and
split suites from the XML entirely, per `docs/RUN_INGESTION.md`. An unrecognized suite name is
adopted once the worker processes the corresponding queued job — the suite is created, along with a
`draft` `TestCase` for every reported case name — and the report is accepted with `202` on its very
first attempt for every suite the file contains, without waiting for that adoption to happen. See
`docs/RUN_INGESTION.md`'s "Suite adoption" and "Response — `202 Accepted`, asynchronous" sections for
the full behavior, including why drafts are not immediately official (§4.3.4 rule b) and how a human
promotes one.

### Does a failed report fail the CI job?

**Not by default.** Every failure path (missing key, missing report file, any non-2xx response, a
network error) is caught and logged as a `::warning::` annotation; the reporter's exit code stays
`0`. Setting `QABLY_FAIL_ON_ERROR=true` in the
step's environment flips that: any warning then makes the reporter exit `1`, for a team that wants
a broken integration to be visible in the job status rather than only in the logs. This repository's
own CI does not set it, so the job's actual pass/fail signal comes entirely from the test step
itself (`jest` / `vitest` exiting non-zero on a real test failure)
— reporting to Qably is a best-effort side channel, not a gate. A Qably-side outage or a revoked key
is Qably's problem, not the pull request's. Blocking merges on the availability of an external,
optional integration is the wrong failure mode — the uploaded JUnit artifact is still there for a
human to inspect either way.
