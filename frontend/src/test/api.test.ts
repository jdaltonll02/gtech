import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock authStore before importing api
vi.mock('../app/store/authStore', () => ({
  useAuthStore: {
    setState: vi.fn(),
    getState: vi.fn(() => ({ user: null, accessToken: null })),
  },
}));

describe('api utility', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('attaches Authorization header when access token exists', async () => {
    localStorage.setItem('access_token', 'test-token');

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: '1' }),
    });
    global.fetch = mockFetch;

    const { api } = await import('../app/utils/api');
    await api.get('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/test',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      })
    );
  });

  it('does not attach Authorization header when no token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    global.fetch = mockFetch;

    const { api } = await import('../app/utils/api');
    await api.get('/test');

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBeUndefined();
  });

  it('returns undefined for 204 No Content', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => { throw new Error('should not parse'); },
    });
    global.fetch = mockFetch;

    const { api } = await import('../app/utils/api');
    const result = await api.delete('/test/1');
    expect(result).toBeUndefined();
  });

  it('throws an error with detail message on non-ok response', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ detail: 'Not found' }),
    });
    global.fetch = mockFetch;

    const { api } = await import('../app/utils/api');
    await expect(api.get('/missing')).rejects.toThrow('Not found');
  });

  it('retries with refreshed token on 401', async () => {
    localStorage.setItem('access_token', 'expired-token');
    localStorage.setItem('refresh_token', 'valid-refresh');

    let callCount = 0;
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'new-token', refresh_token: 'new-refresh' }),
        });
      }
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({ detail: 'Unauthorized' }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ id: '1' }) });
    });
    global.fetch = mockFetch;

    const { api } = await import('../app/utils/api');
    const result = await api.get('/protected');
    expect(result).toEqual({ id: '1' });
    expect(localStorage.getItem('access_token')).toBe('new-token');
  });

  it('clears auth and throws on 401 when refresh also fails', async () => {
    localStorage.setItem('access_token', 'expired-token');
    localStorage.setItem('refresh_token', 'bad-refresh');

    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({ ok: false, status: 401, json: async () => ({ detail: 'Invalid' }) });
      }
      return Promise.resolve({ ok: false, status: 401, json: async () => ({ detail: 'Unauthorized' }) });
    });
    global.fetch = mockFetch;

    const { api } = await import('../app/utils/api');
    await expect(api.get('/protected')).rejects.toThrow();
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
