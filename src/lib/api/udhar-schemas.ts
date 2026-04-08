import { z } from "zod"

export const udharEntryTypeSchema = z.enum([
  "money_given",
  "money_taken",
  "payment_received",
  "payment_made",
])

export type UdharEntryType = z.infer<typeof udharEntryTypeSchema>

/** POST /transactions/udhar — wire body. `note` omitted when empty (optional field). */
export const createUdharEntryRequestSchema = z.object({
  entryType: udharEntryTypeSchema,
  personId: z.string().min(1, "personId is required"),
  amount: z.string().min(1, "amount is required"),
  accountId: z.string().min(1, "accountId is required"),
  date: z.string().min(1, "date is required"),
  dueDate: z.string().min(1, "dueDate is required"),
  note: z.string().optional(),
})

export type CreateUdharEntryRequest = z.infer<typeof createUdharEntryRequestSchema>

export type UdharSuccessEntry = {
  person: unknown
  transaction: unknown
  commitment: unknown
}

export type CreateUdharEntryResult = {
  message: string
  entry?: UdharSuccessEntry
}

/** Build JSON body; only includes `note` when non-empty. */
export function buildUdharEntryPostBody(input: CreateUdharEntryRequest): Record<string, string> {
  const body: Record<string, string> = {
    entryType: input.entryType,
    personId: input.personId,
    amount: input.amount,
    accountId: input.accountId,
    date: input.date,
    dueDate: input.dueDate,
  }
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
      const e = entryRaw as Record<string, unknown>
      return {
        ok: true,
        message: env.data.message,
        entry: {
          person: e.person,
          transaction: e.transaction,
          commitment: e.commitment,
        },
      }
    }
  }
  return { ok: true, message: env.data.message }
}
