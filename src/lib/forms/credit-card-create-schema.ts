import { z } from "zod"

export const creditCardCreateFormSchema = z.object({
  cardName: z.string().min(1, "Enter card name"),
  bankName: z.string().min(1, "Enter bank name"),
  cardNetwork: z.string().min(1, "Select card network"),
  last4: z.string().refine((s) => s.replace(/\D/g, "").length === 4, "Enter last 4 digits"),
  creditLimit: z.string().refine((s) => {
    const digits = s.replace(/\D/g, "")
    return Boolean(digits) && Number(digits) > 0
  }, "Enter valid credit limit"),
  outstanding: z.string(),
  billDay: z.string(),
  dueDay: z.string(),
  interestRate: z.string(),
  minDuePercent: z.string(),
})

export type CreditCardCreateFormValues = z.infer<typeof creditCardCreateFormSchema>

export const creditCardCreateDefaultValues: CreditCardCreateFormValues = {
  cardName: "",
  bankName: "",
  cardNetwork: "",
  last4: "",
  creditLimit: "",
  outstanding: "",
  billDay: "1",
  dueDay: "5",
  interestRate: "3.5",
  minDuePercent: "5",
}
