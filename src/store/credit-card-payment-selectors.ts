import { createSelector } from "@reduxjs/toolkit"
import { baseApi } from "@/store/api/base-api"
import type { RootState } from "@/store"

function toFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const n = Number(String(value).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

const selectCreditCardsResult = baseApi.endpoints.getCreditCardAccountsForPayment.select()

export const selectCreditCardAccountsForPayment = createSelector(
  [(state: RootState) => selectCreditCardsResult(state).data],
  (cards) => cards ?? []
)

export const selectSelectedCreditCardId = (state: RootState) =>
  state.creditCardPaymentUi.selectedCreditCardId

export const selectIsMinimumPaymentEnabled = (state: RootState) =>
  state.creditCardPaymentUi.isMinimumPaymentEnabled

export const selectMinimumAmount = (state: RootState) => state.creditCardPaymentUi.minimumAmount

export const selectSelectedCreditCard = createSelector(
  [selectCreditCardAccountsForPayment, selectSelectedCreditCardId],
  (cards, selectedCreditCardId) =>
    selectedCreditCardId ? (cards.find((card) => card.id === selectedCreditCardId) ?? null) : null
)

export const selectCreditCardPaymentFormState = createSelector(
  [
    selectSelectedCreditCard,
    selectSelectedCreditCardId,
    selectIsMinimumPaymentEnabled,
    selectMinimumAmount,
  ],
  (selectedCard, selectedCreditCardId, isMinimumPaymentEnabled, minimumAmount) => {
    const cardRecord = selectedCard as Record<string, unknown> | null
    const currentOutstanding = round2(
      Math.max(0, toFiniteNumber(cardRecord?.currentOutstanding) ?? 0)
    )
    const clampedMinimumAmount = round2(
      Math.max(0, Math.min(minimumAmount ?? 0, currentOutstanding))
    )
    const paymentAmount = isMinimumPaymentEnabled ? clampedMinimumAmount : currentOutstanding
    return {
      paymentAmount,
      minimumAmount: isMinimumPaymentEnabled ? clampedMinimumAmount : 0,
      isMinimumPaymentEnabled,
      fromAccountId:
        cardRecord && typeof cardRecord.linkedRepaymentAccountId === "string"
          ? cardRecord.linkedRepaymentAccountId
          : null,
      toAccountId: selectedCreditCardId ?? null,
    }
  }
)

export const selectCreditCardPaymentDisabled = createSelector(
  [selectSelectedCreditCard, selectIsMinimumPaymentEnabled, selectMinimumAmount],
  (selectedCard, isMinimumPaymentEnabled, minimumAmount) => {
    if (!selectedCard) return true
    const cardRecord = selectedCard as Record<string, unknown>
    const currentOutstanding = toFiniteNumber(cardRecord.currentOutstanding) ?? 0
    if (currentOutstanding <= 0) return true
    if (!isMinimumPaymentEnabled) return false
    if (minimumAmount === null) return true
    return minimumAmount <= 0
  }
)
