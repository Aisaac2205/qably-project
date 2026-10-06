# Qably API

The API service is the transactional backend for Qably. It handles multi-tenant organization management, test run ingestion from continuous integration pipelines, background AI test case documentation from test source files, deduplication, review workflows, project chat, notifications, Better Auth sessions, and PostgreSQL persistence.

## Architecture

The application is built on NestJS 11 and separates responsibilities across dedicated domain modules under `src/modules`, plus `health` and `reporter` at the top of `src`:

- `organizations`: Organization lifecycle management, slug generation, member roles and member management, plan entitlements, usage (`GET /organizations/current/usage`), and the organization scoping guard.
- `invites`: Organization invitations with hashed single-use tokens, resend and revoke, and the preview and accept flow (`POST /invites/preview`, `POST /invites/accept`).
- `projects`: Project settings, including declared test file patterns, and project-wide documentation requests (`POST /projects/:id/document`).
- `api-keys`: Per-project API key issuance and revocation. Keys have the shape `qbly_<lookup id>_<secret>` and only the SHA-256 hash of the secret is stored.
- `connections`: Organization-level repository connections (GitHub and Bitbucket), the list of repositories available to the user, stack detection, and webhook secret rotation.
- `repository`: Per-project repository settings (webhook secret, access token), source file reading, and test file location.
- `ingestion`: Source code management webhook intake (`POST /webhooks/scm/:provider`), HMAC signature verification against each connection's secret, and the processing of stored events into code changes and extraction jobs.
- `suites`: Test suites and their test cases, per-case and per-suite documentation requests, documentation confirmation, and the keyset-paginated suite list (`GET /suites/summaries`, `GET /suites/tags`).
- `runs`: Ingestion of CI test executions via JSON (`POST /runs/ingest`) and JUnit XML (`POST /runs/ingest/junit`), run status derivation, manual runs, run listing, regressions and push pass-rate queries, and CI run grouping (`GET /ci-runs`).
- `review`: AI extraction coordination, BullMQ worker processors, the keyset-paginated review inbox (`GET /review/inbox`), duplicate candidate ranking, approval and rejection, and versioned test case publishing.
- `proposal-classification`: Re-classification of the pending proposals of a suite against its cases, as an update, a possible duplicate, or neither.
- `ai`: Google Gemini API integration (`@google/genai`) behind the `TestCaseExtractor` port, extraction prompts, the AI entitlement guard (organization flag and plan credits), and the daily call budget. The default model is `gemini-3.1-flash-lite`. The platform default is labelled Aeris in the product.
- `chat`: Project-scoped chat threads (`/projects/:projectId/chat/threads`) answered by Gemini, and sending a suggested case to the review inbox.
- `notifications`: In-app notifications and preferences, Slack and Discord webhooks (`/notification-webhooks`), and email delivery.
- `mailer`: Transactional email through Resend, used by invitations, authentication emails, and notification digests.
- `dashboard`: Overview, summary, traceability calendar, and notification channel data consumed by web clients (`/dashboard/*`).
- `auth`: Better Auth integration for user registration, authentication, and session validation, plus the current user profile (`GET /me`, `PATCH /me`).
- `reporter`: Serves the CI reporter script at `GET /report.mjs`.
- `health`: Liveness and database connectivity probes at `GET /health`.

## Background Workers

Asynchronous workflows run on BullMQ backed by Redis. There is one queue per workflow:

| Queue | Work |
|---|---|
| `ingestion` | Processes stored webhook events: records code changes per project and enqueues extraction jobs. |
| `run-ingest` | Persists the runs of a JUnit report, one job per suite group, and flushes report batches that time out. |
| `extraction` | Reads a test source file at a commit, calls Gemini, and writes structured proposals to the review inbox. Job kinds: `code-change`, `document-case`, `document-file`, `document-suite-metadata`. |
| `proposal-classification` | Re-classifies the pending proposals of a suite after its cases, proposals, or runs change. |
| `notifications` | Fans an event out to organization members as in-app notifications and email, following their preferences, and to enabled Slack and Discord webhooks. |

The JUnit XML body is parsed and validated in the HTTP handler with `fast-xml-parser`, and the endpoint answers `202 Accepted` once the parsed suite groups are queued. `POST /runs/ingest` runs the ingest synchronously and answers `200`.

## Database and Persistence

The service uses PostgreSQL managed through Prisma ORM with the `@prisma/adapter-pg` driver. Schema definitions, indexes, and migrations reside under `prisma/`.

Execute migrations before starting the service:

```bash
pnpm exec prisma migrate dev
```

## Environment Configuration

Configuration variables are validated at startup using Zod in `src/config/env.ts`. If any required key is missing or malformed, application bootstrap terminates immediately.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Environment mode (`development`, `test`, `production`). |
| `PORT` | No | `3001` | HTTP port for the NestJS server. |
| `DATABASE_URL` | Yes | None | PostgreSQL connection string. |
| `REDIS_URL` | Yes | None | Redis connection string for BullMQ workers, the daily AI budget counter, and report batching. |
| `BETTER_AUTH_SECRET` | Yes | None | Signing key for authentication tokens (minimum 32 characters). |
| `BETTER_AUTH_URL` | Yes | None | Canonical base URL of the API. Must be a bare origin with no path, query, or fragment. |
| `WEB_APP_URL` | Yes | None | Allowed CORS origin and trusted web application URL. Must be a bare origin. |
| `ENCRYPTION_KEY` | Yes | None | 64-character hex string for AES-256-GCM encryption of stored secrets. |
| `GITHUB_CLIENT_ID` | Yes | None | GitHub OAuth application identifier. |
| `GITHUB_CLIENT_SECRET` | Yes | None | GitHub OAuth application secret. |
| `GEMINI_API_KEY` | No | None | API key for Google Gemini. If omitted, extraction and chat are disabled and report the provider as unavailable. |
| `GEMINI_MODEL` | No | `gemini-3.1-flash-lite` | Gemini model identifier used for extraction and chat. |
| `AERIS_DAILY_BUDGET` | No | None | Maximum Gemini calls per Pacific calendar day against the platform key, counted in Redis across extraction and chat. If unset, calls are unmetered. |
| `RESEND_API_KEY` | No | None | API key for transactional email through Resend. If omitted, emails are skipped with a warning. |
| `RESEND_FROM_EMAIL` | No | None | Sender address for outgoing email. |

## Available Scripts

Scripts can be executed directly inside `apps/api` or from the monorepo root using `pnpm --filter @qably/api <command>`.

### Development

Start the API in watch mode:

```bash
pnpm run start:dev
```

### Production

Compile the TypeScript project and generate Prisma client:

```bash
pnpm run build
```

Run the compiled bundle:

```bash
pnpm run start:prod
```

### Database Operations

Deploy pending migrations to the database:

```bash
pnpm run db:deploy
```

Populate the database with initial seed records:

```bash
pnpm run db:seed
```

### Testing

Run unit tests:

```bash
pnpm run test
```

Run end-to-end integration tests:

```bash
pnpm run test:e2e
```

Run tests with test coverage reporting:

```bash
pnpm run test:cov
```

Run tests in CI mode with JUnit XML report output:

```bash
pnpm run test:ci
```

Run the end-to-end suite in CI mode with JUnit XML report output:

```bash
pnpm run test:e2e:ci
```

### Quality checks

Lint and type-check the project:

```bash
pnpm run lint
pnpm run type-check
```

### One-off operational scripts

Three scripts under `scripts/` and `ops/` are run by hand by an operator and never by the application. Each has a dedicated runbook:

| Script | Runbook |
|---|---|
| `scripts/backfill-ci-runs.ts` | [`docs/OPS_BACKFILL_CI_RUNS.md`](../../docs/OPS_BACKFILL_CI_RUNS.md) |
| `scripts/reclassify-pending-proposals.ts` | [`docs/OPS_RECLASSIFY_PENDING_PROPOSALS.md`](../../docs/OPS_RECLASSIFY_PENDING_PROPOSALS.md) |
| `ops/review-fallback-cleanup.sql` | [`docs/OPS_REVIEW_FALLBACK_CLEANUP.md`](../../docs/OPS_REVIEW_FALLBACK_CLEANUP.md) |
