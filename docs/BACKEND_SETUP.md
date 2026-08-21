# Qably API — Setup and Architecture

The `@qably/api` service is the transactional backend behind the Qably chain: repository change to test detection, AI extraction, human review, official versioned case, execution and evidence.

## Local setup

```bash
cd apps/api
docker compose up -d
cp .env.example .env
pnpm exec prisma migrate dev --name init
pnpm start:dev
```

The service listens on `PORT` (default `3001`). `GET /health` reports service and database status.

## Environment variables

`.env` is validated at boot by `src/config/env.ts`. A missing or malformed variable aborts startup with an error naming every offending key — the service never starts in a partially configured state.

| Variable | Required | Format | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` \| `test` \| `production` | Defaults to `development`. In `production` the exception filter hides internal error messages. |
| `PORT` | no | integer | HTTP port. Defaults to `3001`. |
| `DATABASE_URL` | yes | URL | PostgreSQL connection string used by the Prisma pg driver adapter. |
| `REDIS_URL` | yes | URL | Redis connection string for BullMQ ingestion and extraction queues. |
| `BETTER_AUTH_SECRET` | yes | string, min 32 chars | Signing secret for better-auth sessions. |
| `BETTER_AUTH_URL` | yes | URL | Public base URL of the API. Also the allowed CORS origin. |
| `ENCRYPTION_KEY` | yes | 64 hex chars | AES-256-GCM key for provider tokens and webhook secrets at rest. Generate with `openssl rand -hex 32`. |
| `GITHUB_CLIENT_ID` | yes | string | GitHub OAuth application id. |
| `GITHUB_CLIENT_SECRET` | yes | string | GitHub OAuth application secret. |
| `ANTHROPIC_API_KEY` | yes | string | Claude API key used by the extraction service. |
| `RESEND_API_KEY` | yes | string | Resend API key used for run notifications. |

Local development values for `DATABASE_URL` and `REDIS_URL` match the `docker-compose.yml` services:

```
DATABASE_URL=postgresql://qably:qably@localhost:5432/qably
REDIS_URL=redis://localhost:6379
```

## Architecture

Modules are organised by feature, not by technical layer. Each feature module owns its controllers, services, repositories and contracts.

```
src/
├── config/     environment parsing and the global ENV provider
├── common/     Result type, Zod validation pipe, exception filter
├── prisma/     PrismaService and the adapters that implement feature contracts
├── health/     liveness and database readiness
├── auth/       sessions, guards, organisation scoping
├── repository/ SCM connections, webhooks, ingestion, code changes
├── review/     AI extraction, proposals, atomic approval
└── runs/       executions, results, evidence, notifications
```

### Dependency inversion

A feature module declares the capability it needs as an interface plus an injection token, and never imports a concrete infrastructure class. `health/health.contracts.ts` declares `DatabaseProbe` and `DATABASE_PROBE`; `prisma/prisma-database.probe.ts` implements it; `health/health.module.ts` binds the two.

This keeps feature services testable without a database and prevents Prisma types from leaking into domain logic.

### Error handling

Domain operations that can fail for expected reasons return `Result<T, E>` from `common/result.ts` — a discriminated union narrowed through `isOk` and `isErr`. Expected failures are values, not exceptions.

`AllExceptionsFilter` handles everything that reaches the HTTP boundary. It preserves the status and body of a thrown `HttpException`, including the structured `issues` array produced by `ZodValidationPipe`, and maps anything else to `500`. Outside production the underlying message is exposed; in production it is replaced with a generic message so connection strings and credentials cannot leak.

### Input validation

Request payloads are validated with Zod schemas through `ZodValidationPipe`. A rejected payload produces `400` with a `issues` array of `{ path, message }` entries.

## Prisma notes

Prisma 7 no longer accepts `url` in `schema.prisma`. The connection string lives in `prisma.config.ts` for the CLI, and `PrismaService` passes it to `PrismaClient` through the `@prisma/adapter-pg` driver adapter.

The client generator is pinned to CommonJS output so the generated code runs under both `nest build` and ts-jest:

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../generated/prisma"
  moduleFormat        = "cjs"
  runtime             = "nodejs"
  importFileExtension = ""
}
```

Without `moduleFormat = "cjs"` the generated client emits `import.meta` and Jest fails to parse it. Without `importFileExtension = ""` the generated modules import `./enums.js`, which resolves at runtime but not under ts-jest.

Derived project figures — health score, suite count, active run count, pending proposal count — are computed in queries rather than stored, so they cannot drift from the rows they summarise.

## Verification

```bash
pnpm --filter @qably/api exec tsc --noEmit
pnpm --filter @qably/api lint
pnpm --filter @qably/api test
pnpm --filter @qably/api test:e2e
pnpm --filter @qably/api build
```
