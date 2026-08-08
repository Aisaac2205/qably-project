# Qably — AI-Native QA Management Platform

Qably is a B2B SaaS platform that eliminates the 20-30 minute manual documentation tax QA engineers pay after writing automated tests. It watches GitHub for `.spec.ts`/`.test.ts` changes, sends them to the Claude API, and turns them into structured test cases ready to confirm in one click — on top of full QA lifecycle management: suites, manual runs, CI/CD pipeline integration, and quality reports. It competes with TestRail, Qase, and Squash TM; the differentiator is the AI layer that converts code into documentation automatically.

Built for QA engineers and QA leads who live in IDEs, terminals, and CI/CD pipelines — technically fluent, efficiency-driven, allergic to visual noise.

## Development Status

This repository is under active development, and **`apps/web` is the primary build today** — a full frontend implemented against a typed in-memory mock store, ahead of the backend. `apps/api` is scaffolded (NestJS + the target stack) but has no business logic yet. `apps/landing` is an untouched Astro starter reserved for the marketing site.

## Monorepo layout

pnpm workspaces orchestrated via Turborepo.

| Path | Stack | Status |
|---|---|---|
| `apps/web` | Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, @base-ui/react | Active — dashboard, projects, suites, runs, AI review, settings, integrations, all built against mock data |
| `apps/api` | NestJS 11, Prisma, Redis, BullMQ, better-auth, Anthropic SDK, Resend, Zod | Scaffolded — dependencies installed, no domain modules implemented yet |
| `apps/landing` | Astro 6, Tailwind v4 | Not started — default starter template |
| `packages/types` | Shared TypeScript contracts (`@qably/types`) consumed by web, and eventually api | Active |
| `packages/config` | Shared `tsconfig.base.json` and lint config | Active |
| `packages/ui` | Shared React component package | Early |

## `apps/web` — application architecture

Since the backend doesn't exist yet, `apps/web` owns the domain model until it's ready to swap in real HTTP calls:

- **Mock-store pattern** (`src/lib/mock-store.ts` + `mock-data.ts` + `use-mock-store.ts`) — a typed, in-memory pub-sub store standing in for the real API. Readers and mutators mirror the shape the eventual NestJS endpoints will expose, so swapping in real requests later is a hook-level change, not a rewrite.
- **Feature slices** (`src/features/*`) — `dashboard`, `projects` (suites nested inside), `runs` (reports nested inside), `ai-review`, `integrations`, `settings`, `auth`. Each slice owns its own components, hooks, and tests.
- **Route groups** (`src/app/(app)/*`) — `dashboard`, `projects`, `settings`, `integrations`, all inside the authenticated App Router shell.
- **App shell** — fixed 160px sidebar (global nav vs. project-context nav) + 36px top bar (breadcrumb, ⌘K search, user menu). See Design system below.

## `apps/api` — planned backend

Currently the default NestJS CLI scaffold (`AppModule` / `AppController` / `AppService`) — no `projects`, `runs`, or `integrations` modules exist yet. The target architecture is already decided through the dependencies installed:

| Dependency | Role |
|---|---|
| Prisma | Database ORM / schema |
| Redis + BullMQ | Async job queue (webhook processing, AI generation jobs) |
| `@anthropic-ai/sdk` | Claude API calls for test case extraction |
| `better-auth` | Authentication |
| `resend` | Transactional email |
| `zod` | Boundary validation |

Once implemented, `apps/web`'s mock-store contracts — typed via `@qably/types` — become the target shape for real controllers, services, and repositories.

## Design system

Defined in `docs/superpowers/specs/2026-06-16-qably-app-shell-design.md`, enforced project-wide via `CLAUDE.md`:

- **Tokens only** — every color is an OKLCH CSS custom property in `apps/web/src/app/globals.css` (`--primary`, `--bg-sidebar`, `--status-*`, …). No hardcoded hex, rgb, or oklch in components.
- **Status clarity** — pass/fail/blocked/skip/running always pair an icon with a label, never color alone (WCAG 2.2 AA).
- **Typography** — Geist Sans (body) + Geist Mono (code and numeric data only). No Inter.
- **Components** — shadcn/ui (new-york), always restyled to project tokens; `@phosphor-icons/react` only, no lucide, no hand-rolled SVGs.

Brand personality: precise, confident, uncluttered — a well-calibrated instrument, not a flashy startup. Anti-references: TestRail's clutter, Qase's generic blue SaaS look, and typical AI-tool purple gradients/glassmorphism.

## Roadmap

Tracked as implementation plans under `docs/superpowers/plans/`:

1. **App shell** (`2026-06-16-qably-app-shell.md`) — sidebar, top bar, dashboard, and a runs executor with keyboard-driven P/F/S/B verdicts. Shipped.
2. **AI Review Copilot** (`2026-07-11-ai-review-copilot.md`) — BYOK provider connections (Claude/Gemini) in Settings, a redesigned review queue with bulk-confirm, duplicate detection, coverage-gap suggestions, and a project-scoped chat that drafts new AI cases into the queue. All AI behavior is currently simulated in the mock store — no real Claude/Gemini calls yet.

Both plans assume a decoupled frontend: real backend wiring (webhook ingestion → BullMQ → Claude → structured cases) replaces the mock store once `apps/api` catches up.

## Development Standards

1. **Strict Type Safety** — dynamic types (`any` and unchecked `unknown`) are not permitted. Input validation happens at application boundaries.
2. **Clean NestJS Architecture** — strict separation between routing (Controllers), business logic (Services), and database access (Repositories).
3. **Component Modularity** — React component logic follows the Single Responsibility Principle; complex local state or query operations are extracted into custom hooks.
4. **Conventional Commits** — English, imperative mood (e.g. `feat(auth): add validation...`).

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 10+ (pinned via `packageManager` in the root `package.json`)

### Setup
```bash
pnpm install
```

### Development
Starts every app's dev server concurrently via Turborepo (`web`, `api`, `landing`):
```bash
pnpm run dev
```

Or target a single app:
```bash
pnpm --filter web dev
```
