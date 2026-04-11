import type { Account } from "@/lib/api/account-schemas"
import { accountAvailableBalanceInrFromApi } from "@/lib/api/account-schemas"
import { creditCardOutstandingInr, isCreditCardAccount } from "@/lib/api/credit-card-map"
import { isLoanAccount, loanOutstandingInr } from "@/lib/api/loan-account-map"
import { formatCurrency } from "@/lib/format"

/**
 * Optional warning when deleting an account that may still carry balances or exposure.
 * Backend remains authoritative; this is UX-only.
 */
export function getAccountDeleteWarning(account: Account): string | null {
  if (isCreditCardAccount(account)) {
    const out = creditCardOutstandingInr(account)
    if (out > 0.01) {
      return `This card has ${formatCurrency(out)} outstanding. Deleting removes this account from the app; ensure your records match.`
    }
    return null
  }
  if (isLoanAccount(account)) {
    const out = loanOutstandingInr(account)
    if (out > 0.01) {
      return `This loan shows ${formatCurrency(out)} outstanding. Deleting removes this account from the app; ensure your records match.`
    }
    return null
  }
  const bal = accountAvailableBalanceInrFromApi(account)
  if (Math.abs(bal) > 0.01) {
    return `This account has balance ${formatCurrency(bal)}. Deleting removes this account from the app; ensure linked transactions and udhar are handled on the server.`
  }
  return null
}
