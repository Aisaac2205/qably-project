import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ReporterModule } from '../src/reporter/reporter.module';

describe('Report (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [ReporterModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('dogfooding guarantee: serves the exact same bytes as apps/api/src/reporter/qably-report.mjs on disk, with the required headers', async () => {
    const source = await readFile(
      join(__dirname, '../src/reporter/qably-report.mjs'),
      'utf8',
    );

    const response = await request(app.getHttpServer())
      .get('/report.mjs')
      .expect(200);

    expect(response.headers['content-type']).toBe(
      'text/javascript; charset=utf-8',
    );
    expect(response.headers['cache-control']).toContain('public');
    expect(response.headers['etag']).toBeDefined();
    expect(response.headers['x-qably-report-version']).toBeDefined();
    expect(response.text).toBe(source);

    const expectedSha256 = createHash('sha256').update(source).digest('hex');
    expect(response.headers['x-qably-report-sha256']).toBe(expectedSha256);
  });

  it('returns 304 with no body when the client sends a matching If-None-Match', async () => {
    const first = await request(app.getHttpServer())
      .get('/report.mjs')
      .expect(200);
    const etag = first.headers['etag'];

    const second = await request(app.getHttpServer())
      .get('/report.mjs')
      .set('If-None-Match', etag)
      .expect(304);

    expect(second.text).toBe('');
  });

  it('is reachable without any authentication', async () => {
    await request(app.getHttpServer()).get('/report.mjs').expect(200);
  });

  it('returns 304 for If-None-Match: *, sending only cache-related headers', async () => {
    const response = await request(app.getHttpServer())
      .get('/report.mjs')
      .set('If-None-Match', '*')
      .expect(304);

    expect(response.headers['etag']).toBeDefined();
    expect(response.headers['content-type']).toBeUndefined();
    expect(response.headers['x-qably-report-version']).toBeUndefined();
  });

  it('returns 304 for a weak validator matching the current ETag', async () => {
    const first = await request(app.getHttpServer())
      .get('/report.mjs')
      .expect(200);
    const etag = first.headers['etag'];

    await request(app.getHttpServer())
      .get('/report.mjs')
      .set('If-None-Match', `W/${etag}`)
      .expect(304);
  });
});
