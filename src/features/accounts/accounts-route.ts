/** Search param keys for deep-linking loan/card detail on `/accounts`. */
export const ACCOUNTS_URL_LOAN = "loan"
export const ACCOUNTS_URL_CARD = "card"
/** Normal bank/wallet account detail. */
export const ACCOUNTS_URL_ACCOUNT = "account"
/** After adding a transaction, scroll/highlight this row once. */
export const ACCOUNTS_HIGHLIGHT_TX = "highlightTx"

export type AccountsDetailParam =
  | { kind: "loan"; id: string }
  | { kind: "card"; id: string }
  | { kind: "account"; id: string }
  | null

/** Path-based detail URLs (replaces legacy `/accounts?account=` / `?loan=` / `?card=`). */
export function buildAccountsDetailPath(detail: AccountsDetailParam): string {
  if (!detail) return "/accounts"
  const id = encodeURIComponent(String(detail.id).trim())
  if (detail.kind === "loan") return `/loans/${id}`
  if (detail.kind === "card") return `/cards/${id}`
  return `/accounts/${id}`
}
