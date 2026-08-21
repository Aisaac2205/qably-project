import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { DATABASE_PROBE } from '../src/health/health.contracts';
import { HealthModule } from '../src/health/health.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;
  const ping = jest.fn();

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(DATABASE_PROBE)
      .useValue({ ping })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
  });

  afterEach(async () => {
    ping.mockReset();
    await app.close();
  });

  it('returns 200 and an ok report when the database answers', async () => {
    ping.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ status: 'ok', database: 'up' }),
    );
  });

  it('returns 200 and a degraded report when the database is unreachable', async () => {
    ping.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({ status: 'degraded', database: 'down' }),
    );
  });

  it('answers 404 through the exception filter for an unknown route', async () => {
    const response = await request(app.getHttpServer())
      .get('/does-not-exist')
      .expect(404);

    expect(response.body).toEqual(
      expect.objectContaining({ statusCode: 404, path: '/does-not-exist' }),
    );
  });
});
