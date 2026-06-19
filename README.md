# Qably - Enterprise QA Management Monorepo

## Development Status
This repository is currently under construction. Active development is underway, and architectural components are being progressively implemented.

## Overview
Qably is a B2B Software-as-a-Service (SaaS) QA management platform that integrates automated AI-driven test case generation. By capturing GitHub webhooks upon code changes, the platform processes test files (such as Playwright or Jest specs), extracts test scenarios using the Claude API, and generates draft test cases for manual confirmation.

The codebase is structured as a monorepo utilizing pnpm workspaces and orchestrated via Turborepo to enforce modularity, consistency, and type safety across services.

## Architecture

### Applications (`apps/`)

* **`apps/web` (Frontend)**
  * **Technology Stack:** Next.js, React, Tailwind CSS.
  * **Responsibility:** Server-side rendering (RSC) for optimized performance and SEO. Client components are reserved strictly for user interactivity. Heavy business logic is decoupled from this presentation layer.

* **`apps/api` (Backend)**
  * **Technology Stack:** NestJS, TypeScript, Prisma, Redis, BullMQ.
  * **Responsibility:** Core business rules, asynchronous job queue processing (via BullMQ/Redis), and database access. Controllers handle incoming HTTP traffic and delegate all business logic to dedicated services.

### Shared Packages (`packages/`)

* **`packages/types`**
  * Contains central interface contracts, data transfer objects (DTOs), and enumerations shared between the frontend and backend.
* **`packages/config`**
  * Houses shared configuration files (such as TSConfig and ESLint rules) to maintain workspace consistency.
* **`packages/ui`**
  * A dedicated component library for shared design tokens and presentation components.

## Development Standards

To ensure codebase maintainability, the following principles are strictly enforced:

1. **Strict Type Safety:** Dynamic types (`any` and unchecked `unknown`) are not permitted. Input validation must be performed at application boundaries.
2. **Clean NestJS Architecture:** Strict separation between routing layers (Controllers), business logic (Services), and database abstraction (Repositories).
3. **Component Modularity:** React component logic must follow the Single Responsibility Principle. Complex local state or query operations must be extracted into custom hooks.
4. **Conventional Commits:** Commit messages must conform to the Conventional Commits specification and be written in Spanish using the imperative mood (e.g., `feat(auth): agregar validación...`).

## Getting Started

### Prerequisites
* Node.js (version 20 or higher recommended)
* pnpm (installed globally)

### Setup
Install workspace dependencies:
```bash
pnpm install
```

Start the local development server (spawns both `apps/web` and `apps/api` concurrently):
```bash
pnpm run dev
```
