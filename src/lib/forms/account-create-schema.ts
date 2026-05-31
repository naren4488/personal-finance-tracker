import { z } from "zod"

const KINDS_WITHOUT_BANK = new Set(["cash", "wallet", "upi"])

export const accountCreateFormSchema = z
  .object({
    accountType: z.string().min(1),
    name: z.string().min(1, "Give your account a name"),
    bankName: z.string(),
    balance: z.string(),
    isActive: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!KINDS_WITHOUT_BANK.has(data.accountType) && !data.bankName.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bankName"],
        message: "Add bank / institution name",
      })
    }
  })

export type AccountCreateFormValues = z.infer<typeof accountCreateFormSchema>

export function balanceDigitsFromForm(balance: string): number {
  const digits = balance.replace(/\D/g, "")
  return digits === "" ? 0 : Number(digits)
}
