import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('POST /movements/validation', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should return 200 when movements match balance deltas', async () => {
    await request(app.getHttpServer())
      .post('/movements/validation')
      .send({
        movements: [
          { id: 1, date: '2026-01-15', label: 'Salary', amount: 3000 },
          { id: 2, date: '2026-01-20', label: 'Rent', amount: -1000 },
        ],
        balances: [
          { date: '2026-01-01', balance: 1000 },
          { date: '2026-01-31', balance: 3000 },
        ],
      })
      .expect(200)
      .expect({ message: 'Accepted' });
  });

  it('should return 400 with reasons when movements do not match balance deltas', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/movements/validation')
      .send({
        movements: [{ id: 1, date: '2026-01-15', label: 'Salary', amount: 3000 }],
        balances: [
          { date: '2026-01-01', balance: 1000 },
          { date: '2026-01-31', balance: 3000 },
        ],
      })
      .expect(400);

    expect(body.message).toBe('Validation failed');
    expect(body.reasons).toHaveLength(1);
    expect(body.reasons[0].difference).toBe(1000);
  });

  it('should return 400 when the request body is invalid', async () => {
    await request(app.getHttpServer())
      .post('/movements/validation')
      .send({
        movements: [{ id: 1, date: '2026-01-15', label: 'Salary', amount: 3000 }],
        balances: [{ date: '2026-01-01', balance: 1000 }],
      })
      .expect(400);
  });
});
