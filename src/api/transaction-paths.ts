/** Relative to the centralized API base URL. */
export const TRANSACTION_PATHS = {
  create: "/transactions",
  recent: "/transactions/recent",
  ledger: "/transactions/ledger",
  udhar: "/transactions/udhar",
  /** Batch lent/borrowed/net per person for an account — same rollups as ledger. */
  udharSummary: "/transactions/udhar-summary",
} as const
