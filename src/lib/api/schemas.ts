import { z } from "zod"

export const transactionTypeSchema = z.enum(["income", "expense", "transfer"])

export const transactionSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  amount: z.number(),
  type: transactionTypeSchema,
  date: z.string(),
  category: z.string().optional(),
  accountId: z.string().optional(),
  accountName: z.string().optional(),
  utr: z.string().optional(),
})

export const transactionListSchema = z.array(transactionSchema)

export type Transaction = z.infer<typeof transactionSchema>
export type TransactionType = z.infer<typeof transactionTypeSchema>

/** Unified POST /transactions transfer routing (account→account, card bill, loan EMI). */
export type TransferDestinationType = "account" | "credit_card_bill" | "loan_emi"

/** Full create payload (Txns modal + quick add) → built into POST /transactions body per type. */
export type CreateTransactionPayload = {
  type: "income" | "expense" | "transfer"
  amount: number
  /** Expense: required for API `category`. */
  category: string
  /** Income: required for API `incomeSource` (e.g. salary, freelance). */
  incomeSource?: string
  /** Transfer → account: destination account id (`accountId` = source). */
  toAccountId?: string
  /** Transfer: `destinationType` + ids for card bill / loan EMI. */
  transferDestination?: TransferDestinationType
  creditCardAccountId?: string
  loanAccountId?: string
  /**
   * Transfer → `loan_payment`: required on payload (UI split).
   * `credit_card_bill`: optional; if omitted, POST uses full amount as principal and `0` interest.
   */
  principalComponent?: number
  interestComponent?: number
  paymentMethod: "account" | "card"
  sourceName: string
  feeAmount: string
  personId?: string
  /**
   * When `personId` is set (on-behalf expense), sent as API `dueDate` (YYYY-MM-DD).
   * Must match the “expected return date” in the add-transaction UI.
   */
  dueDate?: string
  paidOnBehalf: boolean
  scheduled: boolean
  date: string
  note: string
  tags: string[]
  /** List row title when API does not return one */
  displayTitle?: string
  accountId?: string
  accountName?: string
  /**
   * Pay-from account `type` / `kind` from GET /accounts. Used to set expense `sourceType` when
   * both `accountId` and `creditCardAccountId` are not both needed for inference.
   */
  payFromAccountType?: string
  /** Bank / UPI / wallet transfer reference — sent as API `utr` when applicable. */
  utr?: string
}
