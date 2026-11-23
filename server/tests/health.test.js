import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

process.env.SECRET_KEY = 'test-secret-key-that-is-at-least-thirty-two-characters';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.ENVIRONMENT = 'test';
process.env.RATE_LIMIT_PER_MINUTE = '1000';

vi.mock('../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: vi.fn(), $queryRawUnsafe: vi.fn(), $executeRaw: vi.fn(), $executeRawUnsafe: vi.fn(), $transaction: vi.fn() },
  disconnectPrisma: vi.fn(),
}));

let app;
beforeAll(async () => { ({ createApp: app } = await import('../src/app.js')); });

describe('health', () => {
  it('matches the FastAPI health contract and security headers', async () => {
    const response = await request(app()).get('/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', version: '1.0.0' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['permissions-policy']).toBe('camera=(), microphone=(), geolocation=()');
  });

  it('returns the FastAPI detail envelope for unknown API routes', async () => {
    const response = await request(app()).get('/api/v1/not-a-route').expect(404);
    expect(response.body).toEqual({ detail: 'Not Found' });
  });
});
