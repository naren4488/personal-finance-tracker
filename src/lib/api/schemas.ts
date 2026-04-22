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
})

export const transactionListSchema = z.array(transactionSchema)

export type Transaction = z.infer<typeof transactionSchema>
export type TransactionType = z.infer<typeof transactionTypeSchema>

/** Client form: amount as string for controlled `<input type="text" inputMode="decimal">`. */
export const quickTransactionFormSchema = z.object({
  title: z.string().min(1, "Add a short description").max(120),
  amount: z
    .string()
    .min(1, "Enter amount")
    .refine((s) => {
      const n = Number(s.replace(/,/g, ""))
      return !Number.isNaN(n) && n > 0
    }, "Amount must be greater than zero"),
  type: z.enum(["income", "expense"]),
})

export type QuickTransactionFormValues = z.infer<typeof quickTransactionFormSchema>

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
  paidOnBehalf: boolean
  scheduled: boolean
  date: string
  note: string
  tags: string[]
  /** List row title when API does not return one */
  displayTitle?: string
  accountId?: string
  accountName?: string
}

export function toQuickTransactionPayload(
  values: QuickTransactionFormValues,
  defaultAccountId: string
): CreateTransactionPayload {
  const title = values.title.trim()
  return {
    type: values.type,
    amount: Number(values.amount.replace(/,/g, "")),
    category: "Other",
    incomeSource: values.type === "income" ? "other" : undefined,
    paymentMethod: "account",
    sourceName: "Quick add",
    feeAmount: "0",
    paidOnBehalf: false,
    scheduled: false,
    date: new Date().toISOString().slice(0, 10),
    note: title,
    tags: [],
    displayTitle: title,
    accountId: defaultAccountId,
  }
}
