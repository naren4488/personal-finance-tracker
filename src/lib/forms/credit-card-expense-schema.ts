import { z } from "zod"

export function parsePositiveAmount(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

export function parseNonNegativeFee(raw: string | undefined): number | null {
  const t = (raw ?? "").replace(/,/g, "").trim()
  if (!t) return 0
  const n = Number(t)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

/** Zod + RHF: same rules for Add Card Spend and Add Transaction (credit card expense). */
export const cardExpenseFormSchema = z.object({
  amount: z
    .string()
    .min(1, "Enter amount")
    .refine((s) => parsePositiveAmount(s) != null, "Amount must be greater than 0"),
  category: z.string().min(1, "Enter category"),
  creditCardAccountId: z.string().min(1, "Select a credit card"),
  feeAmount: z
    .string()
    .optional()
    .refine(
      (s) => {
        const t = (s ?? "").trim()
        if (!t) return true
        return parseNonNegativeFee(t) !== null
      },
      { message: "Fee must be a non-negative number or empty" }
    ),
  date: z.string().min(1, "Select date"),
  note: z.string(),
  tags: z.array(z.string()),
})

export type CardExpenseFormValues = z.infer<typeof cardExpenseFormSchema>
