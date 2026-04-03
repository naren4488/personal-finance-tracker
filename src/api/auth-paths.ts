/** Relative to API base URL (see `getApiBaseUrl()` + Vite proxy). */
export const AUTH_PATHS = {
  register: "/auth/register",
  login: "/auth/login",
  logout: "/auth/logout",
  refreshToken: "/auth/refresh-token",
} as const
