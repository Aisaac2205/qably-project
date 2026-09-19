# Qably API

The API service is the transactional backend for Qably. It handles multi-tenant organization management, test run ingestion from continuous integration pipelines, background AI test case extraction from source diffs, deduplication, review workflows, Better Auth sessions, and PostgreSQL persistence.

## Architecture

The application is built on NestJS 11 and separates responsibilities across dedicated domain modules:

- `organizations`: Organization lifecycle management, slug generation, member roles, and organization scoping guards.
- `projects`: Project settings, API key issuance with SHA-256 hashing, and repository connections.
- `suites`: Test suites, hierarchical test case structures, and document count consistency.
- `runs`: Ingestion of CI test executions via JSON (`POST /runs/ingest`) and JUnit XML (`POST /runs/ingest/junit`), run status derivation, and execution metrics aggregation.
- `review`: AI test extraction coordination, BullMQ worker processors, duplicate candidate ranking, and versioned test case publishing.
- `repository`: Source code management webhook processing (`POST /webhooks/scm/:provider`), HMAC signature validation, and test file path pattern matching.
- `ai`: Google Gemini API integration (`@google/genai`) using the `gemini-3.1-flash-lite` model for test case extraction, with manual review fallbacks.
- `analytics`: Run metrics, failure trends, and quality health indicators.
- `dashboard`: Windowed run summaries, recent activity feeds, and traceability calendar data consumed by web clients.
- `auth`: Better Auth integration for user registration, authentication, and session validation.
- `health`: Liveness and database connectivity probes at `GET /health`.

## Background Workers

Asynchronous workflows run on BullMQ backed by Redis:

- **Run Ingestion Queue:** Receives raw test run payloads and parses JUnit XML reports asynchronously using `fast-xml-parser`. This prevents heavy XML parsing from blocking HTTP connection threads.
- **Extraction Queue:** Consumes test file diffs received from repository webhooks and sends extraction prompts to the Google Gemini API. Structured test proposals are generated and saved to the review inbox.

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
| `REDIS_URL` | Yes | None | Redis connection string for BullMQ workers. |
| `BETTER_AUTH_SECRET` | Yes | None | Signing key for authentication tokens (minimum 32 characters). |
| `BETTER_AUTH_URL` | Yes | None | Canonical base URL of the API. |
| `WEB_APP_URL` | Yes | None | Allowed CORS origin and trusted web application URL. |
| `ENCRYPTION_KEY` | Yes | None | 64-character hex string for AES-256-GCM encryption of stored secrets. |
| `GITHUB_CLIENT_ID` | Yes | None | GitHub OAuth application identifier. |
| `GITHUB_CLIENT_SECRET` | Yes | None | GitHub OAuth application secret. |
| `GEMINI_API_KEY` | No | None | API key for Google Gemini extraction. If omitted, extraction enters manual review fallback. |
| `GEMINI_MODEL` | No | `gemini-3.1-flash-lite` | Gemini model identifier used for extraction. |
| `AERIS_DAILY_BUDGET` | No | None | Daily token allocation budget for AI extraction. |
| `RESEND_API_KEY` | No | None | API key for transactional email notifications via Resend. |
| `RESEND_FROM_EMAIL` | No | None | Verified sender email address for run alerts. |

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
