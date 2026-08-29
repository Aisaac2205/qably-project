import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  SESSION_READER,
  type SessionContext,
} from '../src/modules/auth/auth.contracts';
import { AUTH_INSTANCE } from '../src/modules/auth/auth.instance';
import { AuthModule } from '../src/modules/auth/auth.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { DATABASE_PROBE } from '../src/health/health.contracts';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/prisma/prisma.service';

const session: SessionContext = {
  user: {
    id: 'user-1',
    email: 'qa@acme.test',
    name: 'Ada',
    emailVerified: true,
  },
  sessionId: 'session-1',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AuthModule, HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(AUTH_INSTANCE)
      .useValue({ handler: () => new Response('{}', { status: 200 }) })
      .overrideProvider(SESSION_READER)
      .useValue({ read })
      .overrideProvider(DATABASE_PROBE)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
  });

  afterEach(async () => {
    read.mockReset();
    await app.close();
  });

  it('rejects a protected route with 401 when no session is present', async () => {
    read.mockResolvedValue(null);

    const response = await request(app.getHttpServer()).get('/me').expect(401);

    expect(response.body).toEqual(
      expect.objectContaining({
        statusCode: 401,
        message: 'Authentication required',
      }),
    );
  });

  it('serves a protected route with the authenticated user when a session is present', async () => {
    read.mockResolvedValue(session);

    const response = await request(app.getHttpServer()).get('/me').expect(200);

    expect(response.body).toEqual({
      id: 'user-1',
      email: 'qa@acme.test',
      name: 'Ada',
      emailVerified: true,
    });
  });

  it('leaves the public health route reachable without a session', async () => {
    read.mockResolvedValue(null);

    await request(app.getHttpServer()).get('/health').expect(200);
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects a protected route when the session reader throws', async () => {
    read.mockRejectedValue(new Error('BETTER_AUTH_SECRET mismatch'));

    const response = await request(app.getHttpServer()).get('/me').expect(401);

    expect(JSON.stringify(response.body)).not.toContain('BETTER_AUTH_SECRET');
  });
});
