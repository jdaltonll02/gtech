import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
  permissions: string[];
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
  hasPermission: (...perms: string[]) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        set({ user: { ...user, permissions: user.permissions ?? [] }, accessToken });
      },
      clearAuth: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        import('./courseStore').then(({ useCourseStore }) => {
          useCourseStore.getState().clearUserData();
        });
        set({ user: null, accessToken: null });
      },
      isAuthenticated: () => !!get().accessToken,
      hasPermission: (...perms: string[]) => {
        const user = get().user;
        if (!user) return false;
        if (user.is_admin) return true;
        return perms.some(p => (user.permissions ?? []).includes(p));
      },
    }),
    { name: 'auth-store', partialize: (s) => ({ user: s.user, accessToken: s.accessToken }) }
  )
);
