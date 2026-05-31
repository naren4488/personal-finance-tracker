import { z } from "zod"
import { resolveEmiDueDayForLoanSubmit } from "@/features/accounts/loan-emi-model"
import { isoDateString } from "@/lib/forms/zod-helpers"

export const loanCreateFormSchema = z
  .object({
    loanType: z.string().min(1),
    loanName: z.string().min(1, "Enter a loan name"),
    bankLender: z.string().min(1, "Enter bank or lender name"),
    principal: z.string().refine((s) => {
      const p = s.replace(/\D/g, "")
      return Boolean(p) && Number(p) > 0
    }, "Enter a valid principal amount"),
    tenureMonths: z
      .string()
      .refine((s) => (Number(s.replace(/\D/g, "")) || 0) >= 1, "Enter tenure in months"),
    startDate: isoDateString,
    dueCycle: z.enum(["fixed", "rolling"]),
    emiDueDay: z.string(),
    overrideEmi: z.boolean(),
    overrideEmiAmount: z.string(),
    loanAccountNo: z.string(),
    interestRate: z.string(),
    linkedRepaymentAccountId: z.string(),
  })
  .superRefine((data, ctx) => {
    const emiDay = resolveEmiDueDayForLoanSubmit({
      dueCycle: data.dueCycle,
      startDate: data.startDate,
      emiDueDay: data.emiDueDay,
      bankLender: data.bankLender,
      principal: data.principal,
      tenureMonths: data.tenureMonths,
      loanAccountNo: data.loanAccountNo,
      interestRate: data.interestRate,
      overrideEmi: data.overrideEmi,
      overrideEmiAmount: data.overrideEmiAmount,
      linkedRepaymentAccountId: data.linkedRepaymentAccountId,
      overdue: false,
      overdueAmount: "",
    })
    if (emiDay == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [data.dueCycle === "rolling" ? "startDate" : "emiDueDay"],
        message: data.dueCycle === "rolling" ? "Enter a valid start date" : "Select EMI due day",
      })
    }
    if (data.overrideEmi) {
      const overrideEmiDigits = Number(data.overrideEmiAmount.replace(/\D/g, "")) || 0
      if (!overrideEmiDigits || overrideEmiDigits <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overrideEmiAmount"],
          message: "Enter a valid custom EMI amount",
        })
      }
    }
  })

export type LoanCreateFormValues = z.infer<typeof loanCreateFormSchema>
