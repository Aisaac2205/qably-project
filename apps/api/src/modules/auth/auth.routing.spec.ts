import { All, Controller, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

@Controller()
class WildcardController {
  @All('api/auth/*path')
  handle(): string {
    return 'hit';
  }
}

@Module({ controllers: [WildcardController] })
class WildcardModule {}

describe('better-auth catch-all route', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [WildcardModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('matches a single-segment endpoint such as get-session', async () => {
    await request(app.getHttpServer())
      .get('/api/auth/get-session')
      .expect(200);
  });

  it('matches a nested endpoint such as sign-in/social', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/sign-in/social')
      .expect(200);
  });
});
