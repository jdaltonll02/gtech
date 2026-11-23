export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:8000'),
} as const;
