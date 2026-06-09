import type { Account } from "@/lib/api/account-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"

/** Account kinds that support optional UTR capture (digital payment rails). */
const DIGITAL_UTR_ACCOUNT_KINDS = new Set(["bank", "upi", "wallet"])

function normalizeAccountKind(account: Pick<Account, "kind" | "type">): string {
  return String(account.kind ?? account.type ?? "")
    .trim()
    .toLowerCase()
}

/** True for bank, UPI, or digital wallet — not cash, credit card, loan, or asset. */
export function isDigitalUtrAccount(
  account: Pick<Account, "kind" | "type"> | undefined | null
): boolean {
  if (!account) return false
  return DIGITAL_UTR_ACCOUNT_KINDS.has(normalizeAccountKind(account))
}

/** Same check using a raw kind/type token (e.g. expense `payFromAccountType`). */
export function isDigitalUtrAccountKind(kindOrType: string | undefined | null): boolean {
  const k = String(kindOrType ?? "")
    .trim()
    .toLowerCase()
  return k.length > 0 && DIGITAL_UTR_ACCOUNT_KINDS.has(k)
}

/** Whether the UTR input should render for the selected source/payment account. */
export function utrFieldVisibleForAccount(
  account: Pick<Account, "kind" | "type"> | undefined | null
): boolean {
  return isDigitalUtrAccount(account)
}

/**
 * Include `utr` in create payloads only for digital accounts (bank / UPI / wallet).
 * Returns empty object when UTR is blank or the account type does not support UTR.
 */
export function utrPayloadField(
  utr: string,
  selectedAccount: Account | undefined
): { utr?: string } {
  const t = utr.trim()
  if (!t || !isDigitalUtrAccount(selectedAccount)) return {}
  return { utr: t }
}

/** UTR reference from transaction API payloads (when backend provides it). */
export function readTransactionUtr(tx: RecentTransaction): string {
  if (typeof tx.utr === "string" && tx.utr.trim()) return tx.utr.trim()
  const rec = tx as unknown as Record<string, unknown>
  for (const key of ["utr", "utr_number", "utrNumber"] as const) {
    const v = rec[key]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

/** Wire-body helper: omit UTR unless the pay-from kind supports it. */
export function optionalUtrWireField(
  utr: string | undefined,
  payFromKind?: string
): { utr?: string } {
  const t = utr?.trim()
  if (!t) return {}
  if (payFromKind && !isDigitalUtrAccountKind(payFromKind)) return {}
  return { utr: t }
}
