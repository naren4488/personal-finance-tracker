import { z } from "zod"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"

export const udharPersonOnlySchema = z.object({
  personName: z.string().min(1, "Enter the person's name"),
  personPhone: z.string(),
})

export function udharEntrySubmitSchema(entryType: UdharEntryType) {
  return z
    .object({
      personMode: z.enum(["new", "existing"]),
      personName: z.string(),
      selectedPersonId: z.string(),
      amount: z.string().refine((s) => {
        const n = s.replace(/\D/g, "")
        return Boolean(n) && Number(n) > 0
      }, "Enter a valid amount"),
      accountId: z.string().min(1, "Select an account"),
      date: z.string(),
      askRepayBy: z.string(),
      payBackBy: z.string(),
      entryType: z.string(),
      fundingSource: z.enum(["account", "credit_card"]),
      feeAmount: z.string(),
    })
    .superRefine((data, ctx) => {
      if (data.personMode === "existing" && !data.selectedPersonId.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["selectedPersonId"],
          message: "Select a person",
        })
      }
      if (data.personMode === "new" && !data.personName.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["personName"],
          message: "Enter the person's name",
        })
      }
      if (entryType === "money_given" && !data.askRepayBy.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["askRepayBy"],
          message: "Select due date",
        })
      }
      if (entryType === "money_taken" && !data.payBackBy.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["payBackBy"],
          message: "Select pay back date",
        })
      }
      if (entryType !== "money_given" && entryType !== "money_taken" && !data.date.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["date"],
          message: "Select date",
        })
      }
      if (data.fundingSource === "credit_card" && data.feeAmount.trim()) {
        const n = Number(data.feeAmount.replace(/,/g, ""))
        if (!Number.isFinite(n) || n < 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["feeAmount"],
            message: "Enter a valid fee amount or leave it empty",
          })
        }
      }
    })
}
