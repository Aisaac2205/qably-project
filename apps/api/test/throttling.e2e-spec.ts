import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { Express } from 'express';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import {
  ADDRESS_LIMIT,
  DEFAULT_LIMIT,
} from '../src/common/throttler/throttler.config';
import { ThrottlingModule } from '../src/common/throttler/throttling.module';
import { ConfigModule } from '../src/config/config.module';
import { ENV } from '../src/config/config.tokens';
import { DATABASE_PROBE } from '../src/health/health.contracts';
import { HealthModule } from '../src/health/health.module';
import { generateApiKeyToken } from '../src/modules/api-keys/lib/token';
import { SESSION_READER } from '../src/modules/auth/auth.contracts';
import { AUTH_INSTANCE } from '../src/modules/auth/auth.instance';
import { AuthModule } from '../src/modules/auth/auth.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { testEnv } from './support/test-env';

const OTHER_ADDRESS = '203.0.113.7';
const ROTATING_ADDRESS = '203.0.113.9';
const HEALTH_REQUESTS = ADDRESS_LIMIT + 100;

describe('Request throttling (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [
        ThrottlingModule,
        ConfigModule,
        PrismaModule,
        AuthModule,
        HealthModule,
      ],
    })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AUTH_INSTANCE)
      .useValue({ handler: () => new Response('{}', { status: 200 }) })
      .overrideProvider(SESSION_READER)
      .useValue({ read: jest.fn().mockResolvedValue(null) })
      .overrideProvider(DATABASE_PROBE)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestApplication();
    (app.getHttpAdapter().getInstance() as Express).set('trust proxy', 1);
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterEach(async () => {
    await app.close();
  });

  function get(
    path: string,
    headers: Record<string, string> = {},
  ): request.Test {
    return request(baseUrl).get(path).set(headers);
  }

  function patch(
    path: string,
    headers: Record<string, string> = {},
  ): request.Test {
    return request(baseUrl).patch(path).set(headers).send({ locale: 'es' });
  }

  async function statusesOf(
    count: number,
    send: (index: number) => request.Test,
  ): Promise<number[]> {
    const statuses: number[] = [];

    for (let index = 0; index < count; index += 1) {
      statuses.push((await send(index)).status);
    }

    return statuses;
  }

  function fromAddress(address: string): Record<string, string> {
    return { 'X-Forwarded-For': address };
  }

  function withKey(address: string): Record<string, string> {
    return {
      ...fromAddress(address),
      Authorization: `Bearer ${generateApiKeyToken().token}`,
    };
  }

  it('registers the throttler ahead of authentication in the application module', () => {
    const imports = Reflect.getMetadata('imports', AppModule) as unknown[];

    expect(imports).toContain(ThrottlingModule);
    expect(imports.indexOf(ThrottlingModule)).toBeLessThan(
      imports.indexOf(AuthModule),
    );
  });

  it('counts requests the session guard rejects, so anonymous hammering ends in 429', async () => {
    const statuses = await statusesOf(DEFAULT_LIMIT + 1, () => get('/me'));

    expect(statuses.slice(0, DEFAULT_LIMIT).every((s) => s === 401)).toBe(true);
    expect(statuses[DEFAULT_LIMIT]).toBe(429);
  });

  it('stops an attacker that rotates a garbage credential on every request', async () => {
    const statuses = await statusesOf(DEFAULT_LIMIT + 1, (index) =>
      get('/me', { Authorization: `Bearer garbage-${index}` }),
    );

    expect(statuses.slice(0, DEFAULT_LIMIT).every((s) => s === 401)).toBe(true);
    expect(statuses[DEFAULT_LIMIT]).toBe(429);
  });

  it('caps an address that rotates well formed keys across routes, while other addresses stay served', async () => {
    const statuses = await statusesOf(ADDRESS_LIMIT + 1, (index) =>
      index % 2 === 0
        ? get('/me', withKey(ROTATING_ADDRESS))
        : patch('/me', withKey(ROTATING_ADDRESS)),
    );

    expect(statuses.slice(0, ADDRESS_LIMIT).every((s) => s === 401)).toBe(true);
    expect(statuses[ADDRESS_LIMIT]).toBe(429);

    await get('/me', withKey(OTHER_ADDRESS)).expect(401);
  });

  it('gives each well formed key its own bucket behind a shared address', async () => {
    const exhausted = generateApiKeyToken().token;
    const sibling = generateApiKeyToken().token;
    const headersFor = (token: string) => ({
      ...fromAddress(OTHER_ADDRESS),
      Authorization: `Bearer ${token}`,
    });

    const statuses = await statusesOf(DEFAULT_LIMIT + 1, () =>
      get('/me', headersFor(exhausted)),
    );

    expect(statuses[DEFAULT_LIMIT]).toBe(429);
    await get('/me', headersFor(sibling)).expect(401);
  });

  it('never throttles the platform healthcheck nor lets it consume the address ceiling', async () => {
    const statuses = await statusesOf(HEALTH_REQUESTS, () =>
      get('/health', fromAddress(OTHER_ADDRESS)),
    );

    expect(statuses.every((s) => s === 200)).toBe(true);
    await get('/me', fromAddress(OTHER_ADDRESS)).expect(401);
  });
});
