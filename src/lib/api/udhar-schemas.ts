import { z } from "zod"

export const udharEntryTypeSchema = z.enum([
  "money_given",
  "money_taken",
  "payment_received",
  "payment_made",
])

export type UdharEntryType = z.infer<typeof udharEntryTypeSchema>

/**
 * POST /transactions/udhar — wire body.
 * Use `accountId` for bank / cash / UPI, or `creditCardAccountId` for card (not both).
 * `feeAmount` is optional; intended for card-funded entries (e.g. cash advance / convenience fee).
 * `note` / `reason` omitted when empty.
 */
export const createUdharEntryRequestSchema = z
  .object({
    entryType: udharEntryTypeSchema,
    personId: z.string().min(1, "personId is required"),
    amount: z.string().min(1, "amount is required"),
    date: z.string().min(1, "date is required"),
    dueDate: z.string().min(1, "dueDate is required"),
    accountId: z.string().optional(),
    creditCardAccountId: z.string().optional(),
    feeAmount: z.string().optional(),
    reason: z.string().optional(),
    note: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    const hasAcc = Boolean(val.accountId?.trim())
    const hasCc = Boolean(val.creditCardAccountId?.trim())
    if (!hasAcc && !hasCc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a bank account or a credit card",
        path: ["accountId"],
      })
    } else if (hasAcc && hasCc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use either accountId or creditCardAccountId, not both",
        path: ["accountId"],
      })
    }
    const fee = val.feeAmount?.trim()
    if (fee && !hasCc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "feeAmount is only used with creditCardAccountId",
        path: ["feeAmount"],
      })
    }
  })

export type CreateUdharEntryRequest = z.infer<typeof createUdharEntryRequestSchema>

const moneyField = z.union([z.string(), z.number()])

/** `data.entry.person` from POST /transactions/udhar success */
export const udharCreatedPersonSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phoneNumber: z.string().optional(),
    isActive: z.boolean().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough()

/** `data.entry.transaction` */
export const udharCreatedTransactionSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    amount: moneyField,
    category: z.string().optional(),
    incomeSource: z.string().optional(),
    paymentMethod: z.string().optional(),
    sourceType: z.string().optional(),
    sourceName: z.string().optional(),
    sourceAccountId: z.string().optional(),
    destinationType: z.string().optional(),
    destinationName: z.string().optional(),
    destinationAccountId: z.string().optional(),
    personId: z.string().optional(),
    feeAmount: moneyField.optional(),
    paidOnBehalf: z.boolean().optional(),
    principalComponent: moneyField.optional(),
    interestComponent: moneyField.optional(),
    date: z.string(),
    note: z.string().optional(),
    tags: z.array(z.string()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough()

/** `data.entry.commitment` (e.g. payable/receivable Udhar commitment) */
export const udharCreatedCommitmentSchema = z
  .object({
    id: z.string(),
    direction: z.string(),
    kind: z.string(),
    title: z.string(),
    amount: moneyField,
    dueDate: z.string(),
    status: z.string(),
    personId: z.string().optional(),
    accountId: z.string().optional(),
    note: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .passthrough()

export const udharCreatedEntrySchema = z.object({
  person: udharCreatedPersonSchema,
  transaction: udharCreatedTransactionSchema,
  commitment: udharCreatedCommitmentSchema,
})

export type UdharCreatedPerson = z.infer<typeof udharCreatedPersonSchema>
export type UdharCreatedTransaction = z.infer<typeof udharCreatedTransactionSchema>
export type UdharCreatedCommitment = z.infer<typeof udharCreatedCommitmentSchema>
export type UdharSuccessEntry = z.infer<typeof udharCreatedEntrySchema>

export type CreateUdharEntryResult = {
  message: string
  entry?: UdharSuccessEntry
}

/** Build JSON body; only includes optional string fields when non-empty. */
export function buildUdharEntryPostBody(input: CreateUdharEntryRequest): Record<string, string> {
  const body: Record<string, string> = {
    entryType: input.entryType,
    personId: input.personId,
    amount: input.amount,
    date: input.date,
    dueDate: input.dueDate,
  }
  const acc = input.accountId?.trim()
  if (acc) body.accountId = acc
  const cc = input.creditCardAccountId?.trim()
  if (cc) body.creditCardAccountId = cc
  const fee = input.feeAmount?.trim()
  if (fee) body.feeAmount = fee
  const reason = input.reason?.trim()
  if (reason) body.reason = reason
  const note = input.note?.trim()
  if (note) body.note = note
  return body
}

export function parseCreateUdharEntrySuccess(
  raw: unknown
): { ok: true; message?: string; entry?: UdharSuccessEntry } | { ok: false; error: string } {
  const env = z
    .object({
      success: z.literal(true),
      message: z.string().optional(),
      data: z.unknown().optional(),
    })
    .safeParse(raw)
  if (!env.success) {
    return { ok: false, error: "Invalid udhar entry response." }
  }
  const data = env.data.data
  if (data !== null && data !== undefined && typeof data === "object" && !Array.isArray(data)) {
    const entryRaw = (data as Record<string, unknown>).entry
    if (entryRaw !== null && typeof entryRaw === "object" && !Array.isArray(entryRaw)) {
      const parsed = udharCreatedEntrySchema.safeParse(entryRaw)
      if (parsed.success) {
        return {
          ok: true,
          message: env.data.message,
          entry: parsed.data,
        }
      }
      if (import.meta.env.DEV) {
        console.warn(
          "[udhar] POST success — entry shape differs from expected schema; using loose parse",
          parsed.error.flatten()
        )
      }
      const e = entryRaw as Record<string, unknown>
      return {
        ok: true,
        message: env.data.message,
        entry: {
          person: e.person,
          transaction: e.transaction,
          commitment: e.commitment,
        } as UdharSuccessEntry,
      }
    }
  }
  return { ok: true, message: env.data.message }
}
