import type { Account } from "@/lib/api/account-schemas"
import { creditCardAvailableCreditInr, isCreditCardAccount } from "@/lib/api/credit-card-map"
import type { DashboardAccountPreview } from "@/lib/api/dashboard-home-schemas"
import {
  isLoanAccount,
  loanOutstandingInr,
  loanPrincipalInr,
  loanTotalPaidInr,
} from "@/lib/api/loan-account-map"

function isCreditCardKind(kind: string): boolean {
  return isCreditCardAccount({ kind, type: kind } as unknown as Account)
}

function isLoanKind(kind: string): boolean {
  return isLoanAccount({ kind, type: kind } as unknown as Account)
}

/**
 * Home dashboard account tile: amount + optional label.
 * Credit card → Available (remaining limit). Loan → Remaining (outstanding). Others → currentBalance.
 */
export function getDashboardAccountDisplay(
  preview: DashboardAccountPreview,
  fullAccount?: Account | null
): { amount: number; label?: string } {
  if (isCreditCardKind(preview.kind)) {
    if (
      preview.availableLimit !== undefined &&
      Number.isFinite(preview.availableLimit) &&
      preview.availableLimit >= 0
    ) {
      return { amount: Math.max(0, preview.availableLimit), label: "Available" }
    }
    if (
      preview.remainingLimit !== undefined &&
      Number.isFinite(preview.remainingLimit) &&
      preview.remainingLimit >= 0
    ) {
      return { amount: Math.max(0, preview.remainingLimit), label: "Available" }
    }

    if (fullAccount && isCreditCardAccount(fullAccount)) {
      return {
        amount: Math.max(0, creditCardAvailableCreditInr(fullAccount)),
        label: "Available",
      }
    }

    const limit = preview.creditLimit
    const used = preview.currentOutstanding
    if (limit > 0) {
      return { amount: Math.max(0, limit - used), label: "Available" }
    }

    return { amount: 0, label: "Available" }
  }

  if (isLoanKind(preview.kind)) {
    const fromPreviewExplicit = [
      preview.remainingBalance,
      preview.outstandingAmount,
      preview.remainingAmount,
    ].find((v) => v !== undefined && Number.isFinite(v) && v >= 0)
    if (fromPreviewExplicit !== undefined) {
      return { amount: Math.max(0, fromPreviewExplicit), label: "Remaining" }
    }

    let loanOutFromFull = 0
    if (fullAccount && isLoanAccount(fullAccount)) {
      loanOutFromFull = loanOutstandingInr(fullAccount)
      if (loanOutFromFull > 0) {
        return { amount: loanOutFromFull, label: "Remaining" }
      }
    }

    if (Number.isFinite(preview.currentOutstanding) && preview.currentOutstanding >= 0) {
      return { amount: Math.max(0, preview.currentOutstanding), label: "Remaining" }
    }

    if (fullAccount && isLoanAccount(fullAccount)) {
      const total =
        preview.totalLoanAmount !== undefined && preview.totalLoanAmount > 0
          ? preview.totalLoanAmount
          : loanPrincipalInr(fullAccount)
      const paid = loanTotalPaidInr(fullAccount)
      if (total > 0 && paid != null) {
        return { amount: Math.max(0, total - paid), label: "Remaining" }
      }
      return { amount: Math.max(0, loanOutFromFull), label: "Remaining" }
    }

    return { amount: 0, label: "Remaining" }
  }

  return { amount: preview.currentBalance }
}
