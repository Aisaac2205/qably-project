import { Controller, INestApplication, Post, Put, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureHttpPipeline } from '../src/common/http/configure-http-pipeline';
import type { RawBodyRequest } from '../src/common/http/raw-body';

interface BodyReport {
  bodyType: string;
  text: string | null;
  hasRawBody: boolean;
}

function reportOn(incoming: RawBodyRequest): BodyReport {
  const body: unknown = incoming.body;

  return {
    bodyType: typeof body,
    text: typeof body === 'string' ? body : null,
    hasRawBody: incoming.rawBody !== undefined,
  };
}

@Controller()
class BodyEchoController {
  @Post('runs/ingest/junit')
  junit(@Req() incoming: RawBodyRequest): BodyReport {
    return reportOn(incoming);
  }

  @Put('runs/ingest/junit')
  junitPut(@Req() incoming: RawBodyRequest): BodyReport {
    return reportOn(incoming);
  }

  @Post('webhooks/scm/:provider')
  webhook(@Req() incoming: RawBodyRequest): BodyReport {
    return reportOn(incoming);
  }

  @Post('runs/ingest')
  runs(@Req() incoming: RawBodyRequest): BodyReport {
    return reportOn(incoming);
  }

  @Post('api/auth/echo')
  auth(@Req() incoming: RawBodyRequest): BodyReport {
    return reportOn(incoming);
  }

  @Post('elsewhere')
  elsewhere(@Req() incoming: RawBodyRequest): BodyReport {
    return reportOn(incoming);
  }
}

const XML = '<testsuite name="checkout"><testcase name="pays"/></testsuite>';
const BYTES_PER_MEGABYTE = 1024 * 1024;
const OVERSIZED_XML = `<testsuite>${'a'.repeat(11 * BYTES_PER_MEGABYTE)}</testsuite>`;
const LARGE_XML = `<testsuite>${'a'.repeat(9 * BYTES_PER_MEGABYTE)}</testsuite>`;

describe('HTTP body parsing pipeline (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [BodyEchoController],
    }).compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    configureHttpPipeline(app, { WEB_APP_URL: 'https://app.qably.test' });
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('XML bodies', () => {
    it.each(['application/xml', 'text/xml'])(
      'parses %s on the JUnit ingestion route',
      async (contentType) => {
        const response = await request(app.getHttpServer())
          .post('/runs/ingest/junit')
          .set('Content-Type', contentType)
          .send(XML)
          .expect(201);

        expect(response.body).toEqual({
          bodyType: 'string',
          text: XML,
          hasRawBody: false,
        });
      },
    );

    it('still accepts a report close to the 10 MB limit on the ingestion route', async () => {
      const response = await request(app.getHttpServer())
        .post('/runs/ingest/junit')
        .set('Content-Type', 'application/xml')
        .send(LARGE_XML)
        .expect(201);

      expect((response.body as BodyReport).bodyType).toBe('string');
    });

    it('rejects a report above the 10 MB limit on the ingestion route', async () => {
      await request(app.getHttpServer())
        .post('/runs/ingest/junit')
        .set('Content-Type', 'application/xml')
        .send(OVERSIZED_XML)
        .expect(413);
    });

    it.each([
      ['a webhook route', '/webhooks/scm/github'],
      ['the JSON ingestion route', '/runs/ingest'],
      ['the auth handler', '/api/auth/echo'],
      ['an unrelated route', '/elsewhere'],
    ])('does not parse XML sent to %s', async (_label, path) => {
      const response = await request(app.getHttpServer())
        .post(path)
        .set('Content-Type', 'application/xml')
        .send(XML)
        .expect(201);

      expect(response.body).toEqual({
        bodyType: 'undefined',
        text: null,
        hasRawBody: false,
      });
    });

    it('does not parse XML sent with another method to the ingestion path', async () => {
      const response = await request(app.getHttpServer())
        .put('/runs/ingest/junit')
        .set('Content-Type', 'application/xml')
        .send(XML)
        .expect(200);

      expect((response.body as BodyReport).bodyType).toBe('undefined');
    });
  });

  describe('JSON bodies', () => {
    const payload = { ref: 'refs/heads/main' };

    it('parses JSON and keeps the raw bytes for signature checks on a webhook route', async () => {
      const response = await request(app.getHttpServer())
        .post('/webhooks/scm/github')
        .send(payload)
        .expect(201);

      expect(response.body).toEqual({
        bodyType: 'object',
        text: null,
        hasRawBody: true,
      });
    });

    it('parses JSON on an unrelated route', async () => {
      const response = await request(app.getHttpServer())
        .post('/elsewhere')
        .send(payload)
        .expect(201);

      expect((response.body as BodyReport).bodyType).toBe('object');
    });

    it('leaves the auth handler to read its own JSON body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/auth/echo')
        .send(payload)
        .expect(201);

      expect(response.body).toEqual({
        bodyType: 'undefined',
        text: null,
        hasRawBody: false,
      });
    });

    it('still parses JSON sent to the JUnit ingestion route', async () => {
      const response = await request(app.getHttpServer())
        .post('/runs/ingest/junit')
        .send(payload)
        .expect(201);

      expect((response.body as BodyReport).bodyType).toBe('object');
    });
  });
});
