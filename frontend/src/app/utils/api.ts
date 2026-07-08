const BASE = '/api/v1';
import { useAuthStore } from '../store/authStore';

function getToken() {
  return localStorage.getItem('access_token');
}

function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}

let refreshInFlight: Promise<string | null> | null = null;

function shouldAttemptRefresh(path: string): boolean {
  return ![
    '/auth/login',
    '/auth/refresh',
    '/auth/register',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/2fa/verify',
    '/auth/2fa/send-code',
    '/auth/oauth-token',
  ].some((authPath) => path.startsWith(authPath));
}

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { access_token: string; refresh_token: string };
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      useAuthStore.setState({ accessToken: data.access_token });
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function clearStoredAuth() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  useAuthStore.setState({ user: null, accessToken: null });
}

async function parseError(res: Response): Promise<Error> {
  const err = await res.json().catch(() => ({ detail: 'Request failed' }));
  return new Error(err.detail ?? 'Request failed');
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && !retried && shouldAttemptRefresh(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    clearStoredAuth();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function requestForm<T>(path: string, body: FormData, options: RequestInit = {}, retried = false): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    method: options.method ?? 'POST',
    body,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401 && !retried && shouldAttemptRefresh(path)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestForm<T>(path, body, options, true);
    }
    clearStoredAuth();
    throw new Error('Session expired. Please sign in again.');
  }

  if (!res.ok) {
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  postForm: <T>(path: string, body: FormData) => requestForm<T>(path, body, { method: 'POST' }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
