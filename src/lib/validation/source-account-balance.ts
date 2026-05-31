import { toast } from "sonner"
import type { Account } from "@/lib/api/account-schemas"
import { accountAvailableBalanceInrFromApi } from "@/lib/api/account-schemas"
import {
  creditCardLimitInr,
  creditCardOutstandingInr,
  isCreditCardAccount,
} from "@/lib/api/credit-card-map"

export const INSUFFICIENT_BALANCE_MESSAGE =
  "You don't have enough balance in this account to complete this transaction."

export const INSUFFICIENT_BALANCE_TOAST_TITLE = "Insufficient Balance"

export const INSUFFICIENT_BALANCE_TOAST_DESCRIPTION = INSUFFICIENT_BALANCE_MESSAGE

function toCents(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/** Returns an inline field error message, or null when the account can cover the amount. */
export function getSourceAccountBalanceError(
  account: Account | null | undefined,
  amountInr: number
): string | null {
  if (!(amountInr > 0)) return null
  if (!account) return INSUFFICIENT_BALANCE_MESSAGE
  if (isCreditCardAccount(account)) {
    const limit = creditCardLimitInr(account)
    if (!(limit > 0)) return null
    const available = limit - creditCardOutstandingInr(account)
    if (toCents(amountInr) > toCents(available)) return INSUFFICIENT_BALANCE_MESSAGE
    return null
  }
  const bal = accountAvailableBalanceInrFromApi(account)
  if (toCents(amountInr) > toCents(bal)) return INSUFFICIENT_BALANCE_MESSAGE
  return null
}

/**
 * Client guard before POST /transactions (or similar): ensure the paying/source account can cover the amount.
 * Prefer `getSourceAccountBalanceError` + inline FormMessage when the form uses RHF.
 */
export function assertSourceAccountCoversAmount(
  account: Account | null | undefined,
  amountInr: number
): boolean {
  const err = getSourceAccountBalanceError(account, amountInr)
  if (err) {
    toast.error(INSUFFICIENT_BALANCE_TOAST_TITLE, { description: err })
    return false
  }
  return true
}
