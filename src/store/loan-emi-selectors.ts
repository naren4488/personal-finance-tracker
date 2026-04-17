import { createSelector } from "@reduxjs/toolkit"
import { baseApi } from "@/store/api/base-api"
import type { RootState } from "@/store"

type LoanEmiReason = "NO_LOAN_SELECTED" | "NO_INSTALLMENTS_LEFT" | "EMI_UNAVAILABLE" | null

type LoanEmiAutoFill = {
  emiTotal: number
  emiInterest: number
  emiPrincipal: number
  fromAccountId: string | null
  toAccountId: string | null
  lastPaymentDate: string | null
  isDisabled: boolean
  reason: LoanEmiReason
}

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const n = Number(String(value).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const selectLoanAccountsResult = baseApi.endpoints.getLoanAccountsForEmi.select()
const selectRecentTxResult = baseApi.endpoints.getRecentTransactionsForEmi.select()

export const selectLoanAccountsForEmi = createSelector(
  [(state: RootState) => selectLoanAccountsResult(state).data],
  (accounts) => accounts ?? []
)

export const selectRecentTransactionsForEmi = createSelector(
  [(state: RootState) => selectRecentTxResult(state).data],
  (transactions) => transactions ?? []
)

export const selectSelectedLoanAccountId = (state: RootState) =>
  state.loanEmiUi.selectedLoanAccountId

export const selectSelectedLoanAccount = createSelector(
  [selectLoanAccountsForEmi, selectSelectedLoanAccountId],
  (accounts, selectedLoanAccountId) =>
    selectedLoanAccountId
      ? (accounts.find((account) => account.id === selectedLoanAccountId) ?? null)
      : null
)

const selectLoanPaymentTransactionsForSelectedLoan = createSelector(
  [selectRecentTransactionsForEmi, selectSelectedLoanAccountId],
  (transactions, selectedLoanAccountId) => {
    if (!selectedLoanAccountId) return []
    const deduped = new Map<string, (typeof transactions)[number]>()
    for (const tx of transactions) {
      const txRecord = tx as Record<string, unknown>
      const title = typeof txRecord.title === "string" ? txRecord.title : ""
      const destinationAccountId =
        typeof txRecord.destinationAccountId === "string" ? txRecord.destinationAccountId : ""
      if (title !== "loan_payment") continue
      if (destinationAccountId !== selectedLoanAccountId) continue
      if (deduped.has(tx.id)) continue
      deduped.set(tx.id, tx)
    }
    return [...deduped.values()].sort((a, b) => b.date.localeCompare(a.date))
  }
)

export const selectLoanEmiAutoFill = createSelector(
  [
    selectSelectedLoanAccount,
    selectSelectedLoanAccountId,
    selectLoanPaymentTransactionsForSelectedLoan,
  ],
  (selectedLoanAccount, selectedLoanAccountId, recentLoanPayments): LoanEmiAutoFill => {
    if (!selectedLoanAccountId || !selectedLoanAccount) {
      return {
        emiTotal: 0,
        emiInterest: 0,
        emiPrincipal: 0,
        fromAccountId: null,
        toAccountId: selectedLoanAccountId ?? null,
        lastPaymentDate: null,
        isDisabled: true,
        reason: "NO_LOAN_SELECTED",
      }
    }

    const loanRecord = selectedLoanAccount as Record<string, unknown>
    const remainingInstallments = toFiniteNumber(loanRecord.remainingInstallments)
    if (remainingInstallments !== null && remainingInstallments <= 0) {
      return {
        emiTotal: 0,
        emiInterest: 0,
        emiPrincipal: 0,
        fromAccountId:
          typeof loanRecord.linkedRepaymentAccountId === "string"
            ? loanRecord.linkedRepaymentAccountId
            : null,
        toAccountId: selectedLoanAccountId,
        lastPaymentDate: recentLoanPayments[0]?.date ?? null,
        isDisabled: true,
        reason: "NO_INSTALLMENTS_LEFT",
      }
    }

    const overrideOn = loanRecord.overrideEmiAmountOn === true
    const overrideEmiAmount = toFiniteNumber(loanRecord.overrideEmiAmount)
    const lastTxAmount = toFiniteNumber(recentLoanPayments[0]?.amount)
    const principalAmount = toFiniteNumber(loanRecord.principalAmount)
    const interestRate = toFiniteNumber(loanRecord.interestRate)
    const tenureMonths = toFiniteNumber(loanRecord.tenureMonths)
    const outstandingPrincipal = toFiniteNumber(loanRecord.currentOutstandingPrincipal) ?? 0

    let emiTotal = 0
    if (overrideOn && overrideEmiAmount !== null) {
      emiTotal = overrideEmiAmount
    } else if (lastTxAmount !== null) {
      emiTotal = lastTxAmount
    } else if (
      principalAmount !== null &&
      interestRate !== null &&
      tenureMonths !== null &&
      tenureMonths > 0
    ) {
      const monthlyRate = interestRate / 12 / 100
      if (monthlyRate === 0) {
        emiTotal = principalAmount / tenureMonths
      } else {
        const pow = (1 + monthlyRate) ** tenureMonths
        const denominator = pow - 1
        emiTotal = denominator !== 0 ? (principalAmount * monthlyRate * pow) / denominator : 0
      }
    }

    const monthlyRateForInterest = interestRate !== null ? interestRate / 12 / 100 : 0
    const emiInterest = round2(
      interestRate !== null ? outstandingPrincipal * monthlyRateForInterest : 0
    )
    const emiPrincipal = round2(Math.max(0, emiTotal - emiInterest))
    const roundedTotal = round2(emiTotal)
    const cannotCalculate = roundedTotal <= 0

    return {
      emiTotal: roundedTotal,
      emiInterest,
      emiPrincipal,
      fromAccountId:
        typeof loanRecord.linkedRepaymentAccountId === "string"
          ? loanRecord.linkedRepaymentAccountId
          : null,
      toAccountId: selectedLoanAccountId,
      lastPaymentDate: recentLoanPayments[0]?.date ?? null,
      isDisabled: cannotCalculate,
      reason: cannotCalculate ? "EMI_UNAVAILABLE" : null,
    }
  }
)
