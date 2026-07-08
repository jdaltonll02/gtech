import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../app/store/authStore';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
  is_admin: false,
};

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, accessToken: null });
  });

  it('starts unauthenticated', () => {
    const { user, accessToken, isAuthenticated } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('setAuth stores user, tokens, and marks authenticated', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-123', 'refresh-456');

    const { user, accessToken, isAuthenticated } = useAuthStore.getState();
    expect(user).toEqual({ ...mockUser, permissions: [] });
    expect(accessToken).toBe('access-123');
    expect(isAuthenticated()).toBe(true);
    expect(localStorage.getItem('access_token')).toBe('access-123');
    expect(localStorage.getItem('refresh_token')).toBe('refresh-456');
  });

  it('clearAuth removes user, tokens, and marks unauthenticated', () => {
    useAuthStore.getState().setAuth(mockUser, 'access-123', 'refresh-456');
    useAuthStore.getState().clearAuth();

    const { user, accessToken, isAuthenticated } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
    expect(isAuthenticated()).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
  });

  it('correctly identifies admin users', () => {
    const adminUser = { ...mockUser, is_admin: true };
    useAuthStore.getState().setAuth(adminUser, 'tok', 'ref');
    expect(useAuthStore.getState().user?.is_admin).toBe(true);
  });

  it('setAuth overwrites previous session', () => {
    const user2 = { ...mockUser, id: 'user-2', email: 'other@example.com' };
    useAuthStore.getState().setAuth(mockUser, 'tok1', 'ref1');
    useAuthStore.getState().setAuth(user2, 'tok2', 'ref2');

    expect(useAuthStore.getState().user?.id).toBe('user-2');
    expect(localStorage.getItem('access_token')).toBe('tok2');
  });
});
