/** Relative to API base URL (`/api` in dev proxies to `/api/v1` on the backend). */
export const TRANSACTION_PATHS = {
  create: "/transactions",
  recent: "/transactions/recent",
  udhar: "/transactions/udhar",
} as const
