/**
 * Opt out of POST /accounts while the backend contract is unfinished.
 * Set `VITE_DISABLE_ACCOUNT_CREATE=true` in `.env.local` (no request is sent).
 */
export function isAccountCreateApiDisabled(): boolean {
  const v = import.meta.env.VITE_DISABLE_ACCOUNT_CREATE
  return String(v).toLowerCase() === "true" || v === "1"
}
