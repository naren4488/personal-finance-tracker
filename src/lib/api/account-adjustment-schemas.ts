import { z } from "zod"

export const createAccountBalanceAdjustmentRequestSchema = z.object({
  targetCurrentBalance: z.string().min(1, "Target balance is required"),
  date: z.string().min(1, "Date is required"),
  reason: z.string().min(1, "Reason is required"),
  note: z.string().optional(),
})

export type CreateAccountBalanceAdjustmentRequest = z.infer<
  typeof createAccountBalanceAdjustmentRequestSchema
>

const adjustmentSchema = z
  .object({
    id: z.string(),
    accountId: z.string().optional(),
    deltaAmount: z.string().optional(),
    targetCurrentBalance: z.string().optional(),
    date: z.string().optional(),
    reason: z.string().optional(),
    note: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough()

export type AccountBalanceAdjustment = z.infer<typeof adjustmentSchema>

export function buildAccountBalanceAdjustmentPostBody(
  input: CreateAccountBalanceAdjustmentRequest
): Record<string, string> {
  const body: Record<string, string> = {
    targetCurrentBalance: input.targetCurrentBalance.trim(),
    date: input.date.trim(),
    reason: input.reason.trim(),
  }
  const note = input.note?.trim()
  if (note) body.note = note
  return body
}

export function parseCreateAccountBalanceAdjustmentSuccess(
  raw: unknown
):
  | { ok: true; message?: string; adjustment?: AccountBalanceAdjustment }
  | { ok: false; error: string } {
  const env = z
    .object({
      success: z.literal(true),
      message: z.string().optional(),
      data: z
        .object({
          adjustment: adjustmentSchema.optional(),
        })
        .passthrough(),
    })
    .safeParse(raw)

  if (env.success) {
    return {
      ok: true,
      message: env.data.message,
      adjustment: env.data.data.adjustment,
    }
  }

  return { ok: false, error: "Invalid account adjustment response." }
}
