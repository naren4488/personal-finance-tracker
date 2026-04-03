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

/** Full create payload (Txns modal + quick add). */
export type CreateTransactionPayload = {
  title: string
  amount: number
  type: "income" | "expense" | "transfer"
  date: string
  category?: string
  accountId?: string
  accountName?: string
}

export function toQuickTransactionPayload(
  values: QuickTransactionFormValues
): CreateTransactionPayload {
  return {
    title: values.title.trim(),
    amount: Number(values.amount.replace(/,/g, "")),
    type: values.type,
    date: new Date().toISOString().slice(0, 10),
  }
}
