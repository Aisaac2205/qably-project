import { INestApplication } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  SESSION_READER,
  type SessionContext,
} from '../src/modules/auth/auth.contracts';
import { AUTH_INSTANCE } from '../src/modules/auth/auth.instance';
import { AuthModule } from '../src/modules/auth/auth.module';
import { EncryptionService } from '../src/common/crypto/encryption.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { jsonWithRawBody } from '../src/common/http/raw-body';
import { ConfigModule } from '../src/config/config.module';
import { ENV } from '../src/config/config.tokens';
import { IngestionModule } from '../src/modules/ingestion/ingestion.module';
import { IngestionProcessor } from '../src/modules/ingestion/ingestion.processor';
import { INGESTION_QUEUE } from '../src/modules/ingestion/ingestion.tokens';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { stubQueues } from './support/stub-queues';
import { testEnv } from './support/test-env';

const session: SessionContext = {
  user: {
    id: 'user-1',
    email: 'ada@acme.test',
    name: 'Ada Lovelace',
    emailVerified: true,
  },
  sessionId: 'session-1',
  expiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

const secret = 'f'.repeat(64);

const pushPayload = {
  ref: 'refs/heads/main',
  repository: { full_name: 'acme/shop' },
  pusher: { name: 'ada' },
  head_commit: {
    id: 'a'.repeat(40),
    message: 'Add checkout guard',
    url: 'https://github.com/acme/shop/commit/aaa',
  },
};

function signed(body: string, signingSecret = secret): string {
  return `sha256=${createHmac('sha256', signingSecret).update(body).digest('hex')}`;
}

describe('SCM webhook ingestion (e2e)', () => {
  let app: INestApplication<App>;
  const read = jest.fn();
  const queue = { add: jest.fn() };
  const prisma = {
    connection: { findMany: jest.fn() },
    scmEvent: { create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    read.mockResolvedValue(session);
    queue.add.mockResolvedValue({ id: 'job-1' });
    prisma.scmEvent.create.mockResolvedValue({ id: 'event-1' });

    const moduleFixture = await stubQueues(
      Test.createTestingModule({
        imports: [ConfigModule, PrismaModule, AuthModule, IngestionModule],
      }),
    )
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(getQueueToken(INGESTION_QUEUE))
      .useValue(queue)
      .overrideProvider(IngestionProcessor)
      .useValue({ process: jest.fn() })
      .overrideProvider(AUTH_INSTANCE)
      .useValue({ handler: () => new Response('{}', { status: 200 }) })
      .overrideProvider(SESSION_READER)
      .useValue({ read })
      .overrideProvider(ENV)
      .useValue(testEnv)
      .compile();

    app = moduleFixture.createNestApplication({ bodyParser: false });
    app.use(jsonWithRawBody());
    app.useGlobalFilters(new AllExceptionsFilter(false));
    await app.init();

    const encryption = app.get(EncryptionService);
    prisma.connection.findMany.mockResolvedValue([
      {
        id: 'connection-1',
        organizationId: 'org-1',
        encryptedWebhookSecret: encryption.encrypt(secret),
      },
    ]);
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts a correctly signed push without a session', async () => {
    read.mockResolvedValue(null);
    const body = JSON.stringify(pushPayload);

    await request(app.getHttpServer())
      .post('/webhooks/scm/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-1')
      .set('x-hub-signature-256', signed(body))
      .send(body)
      .expect(202);

    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('answers 401 when the signature does not match any connection secret', async () => {
    const body = JSON.stringify(pushPayload);

    await request(app.getHttpServer())
      .post('/webhooks/scm/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-1')
      .set('x-hub-signature-256', signed(body, 'attacker'))
      .send(body)
      .expect(401);

    expect(prisma.scmEvent.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('answers 401 when the body was altered after signing', async () => {
    const body = JSON.stringify(pushPayload);
    const tampered = JSON.stringify({
      ...pushPayload,
      pusher: { name: 'eve' },
    });

    await request(app.getHttpServer())
      .post('/webhooks/scm/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-1')
      .set('x-hub-signature-256', signed(body))
      .send(tampered)
      .expect(401);
  });

  it('answers 404 for a provider with no adapter', async () => {
    await request(app.getHttpServer())
      .post('/webhooks/scm/gitlab')
      .set('content-type', 'application/json')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-1')
      .send(JSON.stringify(pushPayload))
      .expect(404);
  });

  it('answers 202 without queueing when the delivery was already stored', async () => {
    prisma.scmEvent.create.mockRejectedValue({ code: 'P2002' });
    const body = JSON.stringify(pushPayload);

    await request(app.getHttpServer())
      .post('/webhooks/scm/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'push')
      .set('x-github-delivery', 'delivery-1')
      .set('x-hub-signature-256', signed(body))
      .send(body)
      .expect(202);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('answers 202 without persisting an event type it does not handle', async () => {
    const body = JSON.stringify(pushPayload);

    await request(app.getHttpServer())
      .post('/webhooks/scm/github')
      .set('content-type', 'application/json')
      .set('x-github-event', 'star')
      .set('x-github-delivery', 'delivery-9')
      .set('x-hub-signature-256', signed(body))
      .send(body)
      .expect(202);

    expect(prisma.scmEvent.create).not.toHaveBeenCalled();
  });
});
