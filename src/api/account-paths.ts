/** Relative to the centralized API base URL. */
export const ACCOUNT_PATHS = {
  list: "/accounts",
  create: "/accounts",
} as const

/** POST — reconcile / set balance from bank statement (backend computes delta). */
export function accountAdjustmentsPath(accountId: string): string {
  const id = accountId.trim()
  return `${ACCOUNT_PATHS.create}/${encodeURIComponent(id)}/adjustments`
}
