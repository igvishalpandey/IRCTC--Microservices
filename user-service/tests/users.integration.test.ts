import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import prisma from '../config/database';
import { createApp } from '../app';

// Requires a migrated Postgres: TEST_DATABASE_URL=... npm test
const hasDb = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDb)('users API (integration)', () => {
  const app = createApp();

  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE users, outbox_events');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a user and records a user.created outbox event atomically', async () => {
    const res = await request(app).post('/api/users').send({ email: 'ada@bank.com', name: 'Ada' });
    expect(res.status).toBe(201);

    const events = await prisma.outboxEvent.findMany();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ topic: 'user.created', key: res.body.data.id, publishedAt: null });
    expect(events[0].payload).toMatchObject({ eventId: events[0].id, data: { userId: res.body.data.id } });
  });

  it('returns 409 on duplicate email without writing an event', async () => {
    await request(app).post('/api/users').send({ email: 'ada@bank.com', name: 'Ada' });
    const res = await request(app).post('/api/users').send({ email: 'ADA@bank.com', name: 'Ada 2' });
    expect(res.status).toBe(409);
    expect(await prisma.outboxEvent.count()).toBe(1);
  });

  it('returns 404 when updating or deleting a missing user', async () => {
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await request(app).patch(`/api/users/${missing}`).send({ name: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/users/${missing}`)).status).toBe(404);
    expect(await prisma.outboxEvent.count()).toBe(0);
  });

  it('paginates', async () => {
    for (const n of [1, 2, 3]) {
      await request(app)
        .post('/api/users')
        .send({ email: `u${n}@bank.com`, name: `U${n}` });
    }
    const res = await request(app).get('/api/users?page=2&limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toEqual({ total: 3, page: 2, limit: 2, totalPages: 2, hasNextPage: false });
  });

  it('reports readiness', async () => {
    expect((await request(app).get('/health/ready')).status).toBe(200);
  });
});
