/**
 * Relative to API base (`/api` in dev). Vite proxy rewrites `/api` → `/api/v1` on the
 * backend, so use `/dashboard/...` here — not `/v1/dashboard/...` — or the path becomes
 * `/api/v1/v1/...` and returns 404.
 */
export const DASHBOARD_PATHS = {
  analytics: "/dashboard/analytics",
} as const
