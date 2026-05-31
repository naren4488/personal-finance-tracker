import type { Account } from "@/lib/api/account-schemas"
import { getSourceAccountBalanceError } from "@/lib/validation/source-account-balance"

export type TransactionSubmitField =
  | "amount"
  | "category"
  | "incomeSource"
  | "accountId"
  | "toAccountId"
  | "creditCardAccountId"
  | "loanAccountId"
  | "onBehalfPersonId"
  | "expectedReturnDate"

export type TransactionSubmitValidationInput = {
  effectiveType: string
  isCreditCardExpenseMode: boolean
  amount: string
  category: string
  incomeSource: string
  validSourceAccountIdForSubmit: string
  transferDestinationType: string
  toAccountId: string
  accountId: string
  creditCardAccountId: string
  isCreditCardPaymentDisabled: boolean
  loanAccountId: string
  loanEmiDisabled: boolean
  effectiveOnBehalfEnabled: boolean
  effectiveOnBehalfPersonId: string
  expectedReturnDate: string
  submitAmountNum: number
  sourceAccount: Account | undefined
  skipBalanceCheck?: boolean
}

export function validateTransactionSubmit(
  input: TransactionSubmitValidationInput
): Partial<Record<TransactionSubmitField, string>> {
  const errors: Partial<Record<TransactionSubmitField, string>> = {}

  if (input.effectiveType !== "transfer") {
    const n = input.amount.replace(/\D/g, "")
    if (!n || Number(n) <= 0) {
      errors.amount = "Enter a valid amount"
    }
  }
  if (input.effectiveType === "expense" && !input.isCreditCardExpenseMode && !input.category) {
    errors.category = "Select a category"
  }
  if (input.effectiveType === "income" && !input.incomeSource) {
    errors.incomeSource = "Select income source"
  }
  if (!input.validSourceAccountIdForSubmit) {
    errors.accountId =
      input.effectiveType === "transfer" ? "Select source account" : "Select an account"
  }

  if (input.effectiveType === "transfer") {
    if (input.transferDestinationType === "account") {
      if (!input.toAccountId) errors.toAccountId = "Select destination account"
      else if (input.toAccountId === input.accountId) {
        errors.toAccountId = "Choose a different account to transfer to"
      }
      const n = input.amount.replace(/\D/g, "")
      if (!n || Number(n) <= 0) errors.amount = "Enter a valid amount"
    } else if (input.transferDestinationType === "credit_card_bill") {
      if (!input.creditCardAccountId) errors.creditCardAccountId = "Select credit card"
      else if (input.isCreditCardPaymentDisabled) {
        errors.creditCardAccountId = "Payment is not available for this card"
      }
    } else if (input.transferDestinationType === "loan_emi") {
      if (!input.loanAccountId) errors.loanAccountId = "Select loan account"
      else if (input.loanEmiDisabled) errors.loanAccountId = "EMI is not available for this loan"
    }
  }

  if (!input.skipBalanceCheck && input.effectiveType !== "income" && input.submitAmountNum > 0) {
    const balanceErr = getSourceAccountBalanceError(input.sourceAccount, input.submitAmountNum)
    if (balanceErr) errors.accountId = balanceErr
  }

  if (input.effectiveOnBehalfEnabled && !input.effectiveOnBehalfPersonId) {
    errors.onBehalfPersonId = "Select a person"
  }
  if (
    input.effectiveOnBehalfEnabled &&
    input.effectiveOnBehalfPersonId &&
    !input.expectedReturnDate.trim()
  ) {
    errors.expectedReturnDate = "Select expected return date"
  }

  return errors
}
