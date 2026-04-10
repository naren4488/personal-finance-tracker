import { toast } from "sonner"
import type { Account } from "@/lib/api/account-schemas"
import { accountAvailableBalanceInrFromApi } from "@/lib/api/account-schemas"
import {
  creditCardLimitInr,
  creditCardOutstandingInr,
  isCreditCardAccount,
} from "@/lib/api/credit-card-map"

export const INSUFFICIENT_BALANCE_TOAST_TITLE = "Insufficient Balance"

export const INSUFFICIENT_BALANCE_TOAST_DESCRIPTION =
  "You don't have enough balance in this account to complete this transaction."

function toCents(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/**
 * Client guard before POST /transactions (or similar): ensure the paying/source account can cover the amount.
 * - Bank/cash/wallet: uses `balance` / `openingBalance` from the account.
 * - Credit card: uses available headroom `limit - outstanding` when limit is known; otherwise allows submit.
 * Do not use for pure **income** (money in).
 */
export function assertSourceAccountCoversAmount(
  account: Account | null | undefined,
  amountInr: number
): boolean {
  if (!(amountInr > 0)) return true
  if (!account) {
    toast.error(INSUFFICIENT_BALANCE_TOAST_TITLE, {
      description: INSUFFICIENT_BALANCE_TOAST_DESCRIPTION,
    })
    return false
  }
  if (isCreditCardAccount(account)) {
    const limit = creditCardLimitInr(account)
    if (!(limit > 0)) return true
    const available = limit - creditCardOutstandingInr(account)
    if (toCents(amountInr) > toCents(available)) {
      toast.error(INSUFFICIENT_BALANCE_TOAST_TITLE, {
        description: INSUFFICIENT_BALANCE_TOAST_DESCRIPTION,
      })
      return false
    }
    return true
  }
  const bal = accountAvailableBalanceInrFromApi(account)
  if (toCents(amountInr) > toCents(bal)) {
    toast.error(INSUFFICIENT_BALANCE_TOAST_TITLE, {
      description: INSUFFICIENT_BALANCE_TOAST_DESCRIPTION,
    })
    return false
  }
  return true
}
