import { z } from "zod"
import { isoDateString } from "@/lib/forms/zod-helpers"

export const adjustBalanceFormSchema = z.object({
  targetBalance: z
    .string()
    .min(1, "Enter a valid target balance")
    .refine((s) => {
      const t = s.replace(/,/g, "").trim()
      if (!t) return false
      const n = Number(t)
      return Number.isFinite(n)
    }, "Enter a valid target balance"),
  date: isoDateString,
  reason: z.string().min(1, "Reason is required"),
  note: z.string(),
})

export type AdjustBalanceFormValues = z.infer<typeof adjustBalanceFormSchema>
