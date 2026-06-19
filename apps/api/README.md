# Qably API

## Development Status
This application service is currently under construction. Active development is underway, and backend modules are being progressively implemented.

## Description
This is the core NestJS backend application for Qably. It handles business logic, asynchronous background tasks (such as AI-driven test case generation via BullMQ and Redis), user authentication via Better Auth, and database persistence with PostgreSQL and Prisma.

## Architecture Guidelines
To ensure maintainability, all development within this module must adhere to the following structure:
1. **Controllers:** Handle HTTP routing, input validation (via DTOs), and response formatting. No direct database access or heavy business logic is permitted here.
2. **Services:** Core business logic and orchestration. Services are decoupled from direct HTTP contexts.
3. **Repositories/Prisma Service:** Data access abstraction.

## Available Scripts

While scripts can be run within this directory, it is recommended to execute them from the monorepo root using `pnpm --filter api <command>`.

### Development
Start the application in development watch mode:
```bash
pnpm run start:dev
```

### Production
Build the NestJS project for production:
```bash
pnpm run build
```

Start the compiled production bundle:
```bash
pnpm run start:prod
```

### Testing
Run unit tests:
```bash
pnpm run test
```

Run end-to-end (e2e) tests:
```bash
pnpm run test:e2e
```

View code coverage report:
```bash
pnpm run test:cov
```
