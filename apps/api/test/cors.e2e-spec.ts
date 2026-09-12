import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { configureHttpPipeline } from '../src/common/http/configure-http-pipeline';
import { buildCorsOptions } from '../src/config/cors';
import { DATABASE_PROBE } from '../src/health/health.contracts';
import { HealthModule } from '../src/health/health.module';

const WEB_ORIGIN = 'http://localhost:3000';
const API_ORIGIN = 'http://localhost:3001';
const PRODUCTION_WEB_ORIGIN = 'https://app.qably.dev';

describe('CORS (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(DATABASE_PROBE)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestApplication();
    app.enableCors(buildCorsOptions({ WEB_APP_URL: `${WEB_ORIGIN}/` }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('allows the web app origin to send credentials', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', WEB_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('answers the preflight a credentialed fetch sends first', async () => {
    const response = await request(app.getHttpServer())
      .options('/health')
      .set('Origin', WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('varies on Origin so a proxy cannot serve one origin the other answer', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', WEB_ORIGIN)
      .expect(200);

    expect(response.headers['vary']).toMatch(/Origin/i);
  });

  it('does not grant an unknown origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://evil.test')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('no longer grants the api its own origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', API_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('CORS headers on a body-parser rejection (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [HealthModule],
    })
      .overrideProvider(DATABASE_PROBE)
      .useValue({ ping: jest.fn().mockResolvedValue(undefined) })
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpPipeline(app, {
      WEB_APP_URL: `${PRODUCTION_WEB_ORIGIN}/`,
    });
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('carries access-control-allow-origin on the 400 the JSON body parser produces', async () => {
    const response = await request(app.getHttpServer())
      .post('/health')
      .set('Origin', PRODUCTION_WEB_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('"not-an-object"')
      .expect(400);

    expect(response.headers['access-control-allow-origin']).toBe(
      PRODUCTION_WEB_ORIGIN,
    );
  });
});
