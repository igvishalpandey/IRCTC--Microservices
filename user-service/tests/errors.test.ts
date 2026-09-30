import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { AppError, isAppError } from '../utils/errors';
import { createApp } from '../app';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: 'test' });

describe('AppError', () => {
  it('derives the HTTP status from the code', () => {
    expect(AppError.notFound().statusCode).toBe(404);
    expect(AppError.validation({}).statusCode).toBe(400);
    expect(AppError.tooManyRequests().statusCode).toBe(429);
  });

  it('exposes 4xx messages and hides 5xx messages by default', () => {
    expect(AppError.conflict('Email taken').publicMessage).toBe('Email taken');
    expect(AppError.internal('pool exhausted at 10.0.0.4').publicMessage).toBe('Internal Server Error');
    expect(AppError.serviceUnavailable().publicMessage).toBe('Service temporarily unavailable');
  });

  it('keeps the original error as cause', () => {
    const original = new Error('boom');
    const err = AppError.from(original);
    expect(err.code).toBe('INTERNAL_ERROR');
    expect(err.cause).toBe(original);
  });

  it('is identifiable via instanceof and the type guard', () => {
    const err = AppError.forbidden();
    expect(err).toBeInstanceOf(Error);
    expect(isAppError(err)).toBe(true);
    expect(err.name).toBe('AppError');
  });
});

describe('AppError.from', () => {
  it('returns AppErrors unchanged', () => {
    const err = AppError.conflict('x');
    expect(AppError.from(err)).toBe(err);
  });

  it('maps zod errors to VALIDATION_ERROR with field details', () => {
    const result = z.object({ email: z.string().email() }).safeParse({ email: 'nope' });
    const err = AppError.from(result.error);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details).toHaveProperty('email');
  });

  it.each([
    ['P2002', 'CONFLICT'],
    ['P2025', 'NOT_FOUND'],
    ['P1001', 'SERVICE_UNAVAILABLE'],
    ['P2024', 'SERVICE_UNAVAILABLE'],
    ['P9999', 'INTERNAL_ERROR'],
  ])('maps Prisma %s to %s', (prismaCode, code) => {
    expect(AppError.from(prismaError(prismaCode)).code).toBe(code);
  });

  it('maps body-parser errors without echoing their message', () => {
    const tooLarge = AppError.from(
      Object.assign(new Error('raw'), { type: 'entity.too.large', status: 413 }),
    );
    expect(tooLarge.code).toBe('PAYLOAD_TOO_LARGE');
    const malformed = AppError.from(
      Object.assign(new Error('Unexpected token s in "secret"'), {
        type: 'entity.parse.failed',
        status: 400,
      }),
    );
    expect(malformed.publicMessage).toBe('Malformed JSON body');
  });

  it('treats non-Error throwables as internal errors', () => {
    expect(AppError.from('string thrown').code).toBe('INTERNAL_ERROR');
    expect(AppError.from(null).code).toBe('INTERNAL_ERROR');
  });
});

describe('HTTP error responses', () => {
  it('returns the JSON error envelope when rate limited', async () => {
    const app = createApp(); // fresh limiter, isolated from other tests
    const limit = Number(process.env.RATE_LIMIT_MAX ?? 100);
    for (let i = 0; i < limit; i++) await request(app).get('/api/users/not-a-uuid');
    const res = await request(app).get('/api/users/not-a-uuid');
    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ success: false, code: 'TOO_MANY_REQUESTS' });
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('returns 413 for oversized bodies', async () => {
    const res = await request(createApp())
      .post('/api/users')
      .send({ email: 'a@b.com', name: 'x'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('uses the envelope for unknown routes', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
  });
});
