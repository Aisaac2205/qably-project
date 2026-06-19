# Qably Web Application

## Development Status
This application service is currently under construction. Active development is underway, and frontend interfaces are being progressively implemented.

## Description
This is the Next.js frontend web application for Qably. It implements a modern user interface for QA management and automated AI test case verification. It consumes the API contracts provided by the backend and utilizes isolated UI components from the shared UI package.

## Architecture Guidelines
To ensure maintainability, all development within this module must adhere to the following principles:
1. **Server Components (RSC):** Render UI elements on the server where possible to optimize load times and SEO. Server Components should handle initial page layout and simple data retrieval.
2. **Client Components:** Reserved exclusively for user interactivity, forms, and client-side states. Mark files with `'use client'` only when strictly necessary.
3. **State Management:** Leverage TanStack Query for server state caching and synchronization. Use Zustand for lightweight, global client state management.
4. **Logic Decoupling:** Keep components focused on layout and presentation. Heavy component state, validation, or event handlers must be abstracted into custom hooks.
5. **UI Component Consistency:** Consume pure presentational components from the `@qably/ui` workspace package rather than implementing bespoke layout components.

## Available Scripts

While scripts can be run within this directory, it is recommended to execute them from the monorepo root using `pnpm --filter web <command>`.

### Development
Start the Next.js development server:
```bash
pnpm run dev
```

### Production
Build the frontend application for production:
```bash
pnpm run build
```

Start the built application locally:
```bash
pnpm run start
```

### Linting
Analyze code quality using ESLint:
```bash
pnpm run lint
```
