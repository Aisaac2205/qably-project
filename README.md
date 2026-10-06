# Qably

Qably is a QA management platform that integrates automated test suites, execution runs, CI pipeline ingestion, and test case documentation. When test files change in a connected repository, or when a user asks for documentation, the platform extracts structured test cases with the Google Gemini API and queues them in a review inbox for human confirmation. The system manages the full quality lifecycle across projects, suites, manual runs, CI reporting, and analytics.

## Monorepo Layout

The repository is managed as a pnpm workspace orchestrated by Turborepo.

| Path | Stack | Description |
|---|---|---|
| `apps/web` | Next.js 16 (App Router), React 19, Tailwind v4, TanStack Query, Zustand, Better Auth client | Primary web console for the dashboard, test library, CI and manual runs, review inbox, Aeris project chat, notifications, and organization and project settings. Communicates with `apps/api` over HTTP and requires `NEXT_PUBLIC_API_URL`. |
| `apps/api` | NestJS 11, PostgreSQL, Prisma ORM, Redis, BullMQ, Better Auth, Google Gemini (`@google/genai`), Resend | Core transactional backend handling organizations, projects, test run ingestion (JSON and JUnit XML), async AI test case extraction, and webhook integrations. |
| `apps/landing` | Astro 7, React 19 islands, Tailwind v4, Motion | Public marketing site and interactive technical documentation reader supporting Spanish (`/`) and English (`/en/`). |
| `packages/types` | TypeScript | Shared domain interfaces, status unions, API contracts, and a few pure helpers used by both apps (`@qably/types`). |
| `packages/ui` | React 19, Tailwind v4, Recharts | Shared dashboard primitives including KPI tiles, status chips, sparklines, gauges, delivery bars, and a Recharts chart primitive (`@qably/ui`). |
| `packages/i18n` | TypeScript | Centralized localization dictionaries (`en.json`, `es.json`) and RFC 4647/7231 locale negotiation helpers (`@qably/i18n`). |
| `packages/test-naming` | TypeScript | Shared utilities for sanitizing, formatting, and humanizing test and suite identifiers (`@qably/test-naming`). |
| `packages/config` | TypeScript | Shared TypeScript configuration (`tsconfig.base.json`) used across the workspace (`@qably/config`). |

## Architecture Overview

Qably isolates data ingestion into two independent channels:

1. **Test Run Ingestion:** CI pipelines send execution results to `POST /runs/ingest` or `POST /runs/ingest/junit` using a project API key (`Authorization: Bearer <key>`). The backend stores each run with its per-case results and failure details, and derives run status and suite health from them. The JSON endpoint answers `200` after processing the run; the JUnit endpoint parses the XML in the HTTP handler and answers `202` once the parsed suites are queued.
2. **Repository Changes:** Source code providers send push events to `POST /webhooks/scm/:provider` with HMAC signatures. The backend enqueues jobs in Redis via BullMQ, reads the changed test files at the pushed commit, and prompts the Google Gemini API (default model `gemini-3.1-flash-lite`, set by `GEMINI_MODEL`) to extract structured test proposals into the review inbox.

The frontend (`apps/web`) communicates with `apps/api` through a centralized client that automatically attaches the current organization identifier (`x-organization-id`) and sends the Better Auth session cookies. The web application reads its feature data from a running `apps/api` instance.

## Design System

The product interface enforces strict design constraints documented in `CLAUDE.md`:

- **Tokens Only:** All styling relies on CSS custom properties. Component files must not declare hardcoded hex, rgb, or oklch values.
- **Typography:** Geist Sans for general interface typography and Geist Mono for code snippets and tabular metrics.
- **Component Primitives:** Customized shadcn/ui components paired with `@phosphor-icons/react`. Third-party icon sets like Lucide are excluded.
- **Accessibility:** Status indicators always pair distinct labels with icons so color is never the single differentiator.

## Prerequisites

- Node.js >= 22.22.1 (enforced by `engines` and `engine-strict=true` in `.npmrc`)
- pnpm >= 10.0.0 (version 10.33.0 is configured in `package.json`)
- PostgreSQL and Redis for `apps/api`. `apps/api/docker-compose.yml` starts both locally with Docker.

## Getting Started

Install workspace dependencies from the root directory:

```bash
pnpm install
```

Start the apps that define a `dev` script, `apps/web` and `apps/landing`, concurrently:

```bash
pnpm run dev
```

`apps/api` has no `dev` script, so `pnpm run dev` does not start it. Target a single application with the `--filter` flag:

```bash
# Start the web console
pnpm --filter @qably/web dev

# Start the NestJS API
pnpm --filter @qably/api start:dev

# Start the landing and documentation site
pnpm --filter @qably/landing dev
```

## Workspace Commands

The root `package.json` provides scripts that Turborepo runs in every workspace member that defines the matching script:

- `pnpm run build` runs production builds.
- `pnpm run lint` executes ESLint in `apps/api` and `apps/web`.
- `pnpm run type-check` verifies TypeScript types across the apps and packages.

For service-specific testing and database operations, consult the README inside each application folder:

- [`apps/api/README.md`](apps/api/README.md) for modules, background workers, environment variables, database migrations, and backend test runners.
- [`apps/web/README.md`](apps/web/README.md) for frontend component testing and state management architecture.
- [`apps/landing/README.md`](apps/landing/README.md) for public marketing routes, docs content, and preview islands.
