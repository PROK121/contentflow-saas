import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Deals (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.DISABLE_API_AUTH = '1';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    delete process.env.DISABLE_API_AUTH;
  });

  it('/v1/deals (GET) accepts kind=sale and returns an array', () => {
    return request(app.getHttpServer())
      .get('/v1/deals')
      .query({ kind: 'sale' })
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('/v1/deals (GET) ignores unknown kind and returns an array', () => {
    return request(app.getHttpServer())
      .get('/v1/deals')
      .query({ kind: 'not-a-kind' })
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });
});
