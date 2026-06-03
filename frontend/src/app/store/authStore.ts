import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  is_admin: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        set({ user, accessToken });
      },
      clearAuth: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // Clear all user-specific course data so stale enrollment/progress
        // is never shown to a logged-out or different user.
        import('./courseStore').then(({ useCourseStore }) => {
          useCourseStore.getState().clearUserData();
        });
        set({ user: null, accessToken: null });
      },
      isAuthenticated: () => !!get().accessToken,
    }),
    { name: 'auth-store', partialize: (s) => ({ user: s.user, accessToken: s.accessToken }) }
  )
);
