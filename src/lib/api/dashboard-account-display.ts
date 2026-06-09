import type { Account } from "@/lib/api/account-schemas"
import { accountAvailableBalanceInrFromApi } from "@/lib/api/account-schemas"
import { creditCardAvailableCreditInr, isCreditCardAccount } from "@/lib/api/credit-card-map"
import {
  isLoanAccount,
  loanPaidInstallments,
  loanRemainingInstallments,
} from "@/lib/api/loan-account-map"
import type { DashboardAccountPreview } from "@/lib/api/dashboard-home-schemas"

export type HomeAccountCardDisplay =
  | { mode: "currency"; amount: number; contextLabel: string }
  | { mode: "count"; count: number; contextLabel: string }
  | { mode: "unavailable"; contextLabel: string }

function isCreditCardKind(kind: string): boolean {
  return isCreditCardAccount({ kind, type: kind } as unknown as Account)
}

function isLoanKind(kind: string): boolean {
  return isLoanAccount({ kind, type: kind } as unknown as Account)
}

function isAssetKind(kind: string): boolean {
  const k = kind.trim().toLowerCase()
  return k === "asset" || k.includes("asset") || k.includes("property")
}

function loanEmiScheduleKnown(preview: DashboardAccountPreview, fullAccount?: Account): boolean {
  if (preview.remainingInstallments !== undefined) return true
  if (!fullAccount) return false
  const r = fullAccount as unknown as Record<string, unknown>
  if (r.remainingInstallments != null || r.remaining_installments != null) return true
  if (r.tenureMonths != null || r.tenure_months != null) return true
  return loanPaidInstallments(fullAccount) > 0
}

function resolveLoanRemainingEmiCount(
  preview: DashboardAccountPreview,
  fullAccount?: Account
): number | null {
  const fromPreview = preview.remainingInstallments
  if (fromPreview !== undefined) return fromPreview

  if (!fullAccount || !isLoanAccount(fullAccount)) return null
  if (!loanEmiScheduleKnown(preview, fullAccount)) return null
  return loanRemainingInstallments(fullAccount)
}

function resolveCreditCardAvailableInr(
  preview: DashboardAccountPreview,
  fullAccount?: Account
): number | null {
  if (preview.availableLimit !== undefined && Number.isFinite(preview.availableLimit)) {
    return preview.availableLimit
  }
  if (preview.remainingLimit !== undefined && Number.isFinite(preview.remainingLimit)) {
    return preview.remainingLimit
  }
  if (fullAccount && isCreditCardAccount(fullAccount)) {
    return creditCardAvailableCreditInr(fullAccount)
  }
  if (preview.creditLimit > 0) {
    return preview.creditLimit - preview.currentOutstanding
  }
  return null
}

function resolveBalanceInr(preview: DashboardAccountPreview, fullAccount?: Account): number {
  if (fullAccount) return accountAvailableBalanceInrFromApi(fullAccount)
  return preview.currentBalance
}

/**
 * Home “Your accounts” tile: balance, available credit, or remaining EMI count.
 * Prefers dashboard preview fields; uses full `Account` from GET /accounts for gaps.
 */
export function getHomeAccountCardDisplay(
  preview: DashboardAccountPreview,
  fullAccount?: Account
): HomeAccountCardDisplay {
  if (isCreditCardKind(preview.kind)) {
    const available = resolveCreditCardAvailableInr(preview, fullAccount)
    if (available === null || !Number.isFinite(available)) {
      return { mode: "unavailable", contextLabel: "Available" }
    }
    return { mode: "currency", amount: available, contextLabel: "Available" }
  }

  if (isLoanKind(preview.kind)) {
    const count = resolveLoanRemainingEmiCount(preview, fullAccount)
    if (count === null) {
      return { mode: "unavailable", contextLabel: "EMIs left" }
    }
    return { mode: "count", count, contextLabel: "EMIs left" }
  }

  const contextLabel = isAssetKind(preview.kind) ? "Value" : "Balance"
  return {
    mode: "currency",
    amount: resolveBalanceInr(preview, fullAccount),
    contextLabel,
  }
}
