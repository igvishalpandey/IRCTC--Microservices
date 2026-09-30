import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { AppError } from '../utils/errors';
import { userService } from '../services/user.service';
import { createApp } from '../app';

vi.mock('../services/user.service', () => ({
  userService: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const app = createApp();

const id = '0b6f1c1e-3f7a-4c1e-9a55-1c2d3e4f5a6b';
const user = { id, email: 'a@b.com', name: 'Ada', createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => vi.clearAllMocks());

describe('health', () => {
  it('GET /health/live returns ok', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('request id', () => {
  it('echoes an incoming x-request-id', async () => {
    const res = await request(app).get('/health/live').set('x-request-id', 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
  });

  it('generates one when absent', async () => {
    const res = await request(app).get('/health/live');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('POST /api/users', () => {
  it('rejects invalid bodies with 400 and field errors', async () => {
    const res = await request(app).post('/api/users').send({ email: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details).toHaveProperty('email');
    expect(res.body.details).toHaveProperty('name');
    expect(userService.create).not.toHaveBeenCalled();
  });

  it('rejects unknown fields', async () => {
    const res = await request(app).post('/api/users').send({ email: 'a@b.com', name: 'Ada', role: 'admin' });
    expect(res.status).toBe(400);
  });

  it('normalises input and returns 201', async () => {
    vi.mocked(userService.create).mockResolvedValue(user);
    const res = await request(app).post('/api/users').send({ email: '  A@B.COM ', name: ' Ada ' });
    expect(res.status).toBe(201);
    expect(userService.create).toHaveBeenCalledWith({ email: 'a@b.com', name: 'Ada' });
  });

  it('maps domain conflicts to 409', async () => {
    vi.mocked(userService.create).mockRejectedValue(
      AppError.conflict('A user with this email already exists'),
    );
    const res = await request(app).post('/api/users').send({ email: 'a@b.com', name: 'Ada' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CONFLICT');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app).post('/api/users').set('content-type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/users', () => {
  it('rejects non-uuid ids', async () => {
    const res = await request(app).get('/api/users/123');
    expect(res.status).toBe(400);
    expect(userService.findById).not.toHaveBeenCalled();
  });

  it('caps page size', async () => {
    const res = await request(app).get('/api/users?limit=1000');
    expect(res.status).toBe(400);
  });

  it('returns pagination meta', async () => {
    vi.mocked(userService.findAll).mockResolvedValue({ items: [user], total: 1, page: 1, limit: 20 });
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false });
  });
});

describe('error handling', () => {
  it('hides internal error details', async () => {
    vi.mocked(userService.findById).mockRejectedValue(new Error('connection string leaked'));
    const res = await request(app).get(`/api/users/${id}`);
    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Internal Server Error');
    expect(JSON.stringify(res.body)).not.toContain('leaked');
    expect(res.body.requestId).toBeTruthy();
  });

  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});

describe('CORS', () => {
  it('allows listed origins with credentials and exposes the request id', async () => {
    const res = await request(app).get('/health/live').set('Origin', 'https://app.bank.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://app.bank.com');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });

  it('allows wildcard subdomains', async () => {
    const res = await request(app).get('/health/live').set('Origin', 'https://acme.partners.bank.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://acme.partners.bank.com');
  });

  it('does not treat the wildcard as matching the bare or look-alike domains', async () => {
    for (const origin of ['https://partners.bank.com', 'https://evil.partners.bank.com.attacker.io']) {
      const res = await request(app).get('/health/live').set('Origin', origin);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  it('omits CORS headers for unknown origins without failing the request', async () => {
    const res = await request(app).get('/health/live').set('Origin', 'https://evil.com');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('answers preflight requests', async () => {
    const res = await request(app)
      .options('/api/users')
      .set('Origin', 'https://app.bank.com')
      .set('Access-Control-Request-Method', 'PATCH');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('PATCH');
    expect(res.headers['access-control-max-age']).toBe('600');
  });
});

describe('response envelope', () => {
  it('wraps created resources', async () => {
    vi.mocked(userService.create).mockResolvedValue(user);
    const res = await request(app).post('/api/users').send({ email: 'a@b.com', name: 'Ada' });
    expect(res.body).toMatchObject({ success: true, message: 'User created successfully', data: { id } });
  });

  it('reports when more pages exist', async () => {
    vi.mocked(userService.findAll).mockResolvedValue({ items: [user], total: 45, page: 2, limit: 20 });
    const res = await request(app).get('/api/users?page=2');
    expect(res.body.meta).toEqual({ total: 45, page: 2, limit: 20, totalPages: 3, hasNextPage: true });
  });
});
