import type { SetURLSearchParams } from "react-router-dom"

/** Search param keys for deep-linking loan/card detail on `/accounts`. */
export const ACCOUNTS_URL_LOAN = "loan"
export const ACCOUNTS_URL_CARD = "card"

export type AccountsDetailParam = { kind: "loan" | "card"; id: string } | null

export function buildAccountsDetailPath(detail: AccountsDetailParam): string {
  if (!detail) return "/accounts"
  const q = new URLSearchParams()
  q.set(detail.kind === "loan" ? ACCOUNTS_URL_LOAN : ACCOUNTS_URL_CARD, detail.id)
  return `/accounts?${q.toString()}`
}

/** Keeps loan/card detail in the URL so overlays + modals can close without losing account context. */
export function applyAccountsDetailSearch(
  setSearchParams: SetURLSearchParams,
  detail: AccountsDetailParam
) {
  setSearchParams(
    (prev) => {
      const p = new URLSearchParams(prev)
      p.delete(ACCOUNTS_URL_LOAN)
      p.delete(ACCOUNTS_URL_CARD)
      if (detail) {
        p.set(detail.kind === "loan" ? ACCOUNTS_URL_LOAN : ACCOUNTS_URL_CARD, detail.id)
      }
      return p
    },
    { replace: true }
  )
}
