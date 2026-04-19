import type { SetURLSearchParams } from "react-router-dom"

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

export function buildAccountsDetailPath(detail: AccountsDetailParam): string {
  if (!detail) return "/accounts"
  const q = new URLSearchParams()
  if (detail.kind === "loan") q.set(ACCOUNTS_URL_LOAN, detail.id)
  else if (detail.kind === "card") q.set(ACCOUNTS_URL_CARD, detail.id)
  else q.set(ACCOUNTS_URL_ACCOUNT, detail.id)
  return `/accounts?${q.toString()}`
}

/**
 * Sets or clears `?loan=` / `?card=` / `?account=` for **explicit detail navigation** (row tap, deep link).
 * Pay EMI / Pay Bill / Add Spend flows must not rely on these params — use React state only.
 */
export function applyAccountsDetailSearch(
  setSearchParams: SetURLSearchParams,
  detail: AccountsDetailParam
) {
  setSearchParams(
    (prev) => {
      const p = new URLSearchParams(prev)
      p.delete(ACCOUNTS_URL_LOAN)
      p.delete(ACCOUNTS_URL_CARD)
      p.delete(ACCOUNTS_URL_ACCOUNT)
      p.delete(ACCOUNTS_HIGHLIGHT_TX)
      if (detail) {
        if (detail.kind === "loan") p.set(ACCOUNTS_URL_LOAN, detail.id)
        else if (detail.kind === "card") p.set(ACCOUNTS_URL_CARD, detail.id)
        else p.set(ACCOUNTS_URL_ACCOUNT, detail.id)
      }
      return p
    },
    { replace: true }
  )
}
