import { z } from "zod"
import type { CreateTransactionPayload, Transaction } from "@/lib/api/schemas"
import { transactionTypeSchema } from "@/lib/api/schemas"

/** POST /transactions JSON body (amounts as strings per API). */
export const createTransactionApiBodySchema = z.object({
  type: transactionTypeSchema,
  amount: z.string().min(1),
  category: z.string(),
  paymentMethod: z.string(),
  sourceName: z.string(),
  feeAmount: z.string(),
  paidOnBehalf: z.boolean(),
  scheduled: z.boolean(),
  date: z.string(),
  note: z.string(),
  tags: z.array(z.string()),
})

export type CreateTransactionApiBody = z.infer<typeof createTransactionApiBodySchema>

const looseTransactionFields = z.object({
  id: z.string().optional(),
  type: transactionTypeSchema.optional(),
  amount: z.union([z.number(), z.string()]).optional(),
  date: z.string().optional(),
  category: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).optional(),
  sourceName: z.string().optional(),
  title: z.string().optional(),
})

function parseAmount(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, ""))
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

/**
 * Parse `{ success: true, data: { transaction } }`, `data` as transaction, or a bare transaction object.
 */
export function parseCreateTransactionSuccess(
  raw: unknown
): { ok: true; transaction: Record<string, unknown> } | { ok: false; error: string } {
  const rec = z.record(z.string(), z.unknown()).safeParse(raw)
  if (!rec.success) {
    return { ok: false, error: "Invalid create transaction response." }
  }
  const o = rec.data
  if (
    o.success === true &&
    o.data != null &&
    typeof o.data === "object" &&
    !Array.isArray(o.data)
  ) {
    const data = o.data as Record<string, unknown>
    const inner = data.transaction
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return { ok: true, transaction: inner as Record<string, unknown> }
    }
    return { ok: true, transaction: data }
  }
  if (typeof o.id === "string") {
    return { ok: true, transaction: o }
  }
  return { ok: false, error: "Could not read transaction from response data." }
}

export function mapApiTransactionToClient(
  apiTx: Record<string, unknown>,
  fallback: CreateTransactionPayload
): Transaction {
  const parsed = looseTransactionFields.safeParse(apiTx)
  const t = parsed.success ? parsed.data : {}

  const amount = parseAmount(t.amount ?? fallback.amount)
  const note = typeof t.note === "string" ? t.note : fallback.note
  const tags = Array.isArray(t.tags)
    ? t.tags.filter((x): x is string => typeof x === "string")
    : fallback.tags
  const tagLine = tags.length ? tags.join(" · ") : ""
  const titleFromApi = typeof t.title === "string" ? t.title : ""
  const title =
    titleFromApi ||
    fallback.displayTitle ||
    [note, tagLine].filter(Boolean).join(" · ") ||
    fallback.category ||
    "Transaction"

  const id = typeof t.id === "string" ? t.id : crypto.randomUUID()
  const type = t.type ?? fallback.type
  const date = typeof t.date === "string" ? t.date : fallback.date
  const category = typeof t.category === "string" ? t.category : fallback.category
  const sourceName =
    typeof t.sourceName === "string" ? t.sourceName : fallback.sourceName || fallback.accountName

  return {
    id,
    title: title.trim() || "Transaction",
    amount,
    type,
    date,
    category: category || undefined,
    accountId: fallback.accountId,
    accountName: sourceName || fallback.accountName,
  }
}

export function payloadToApiBody(body: CreateTransactionPayload): CreateTransactionApiBody {
  return {
    type: body.type,
    amount: String(body.amount),
    category: body.category,
    paymentMethod: body.paymentMethod,
    sourceName: body.sourceName,
    feeAmount: body.feeAmount,
    paidOnBehalf: body.paidOnBehalf,
    scheduled: body.scheduled,
    date: body.date,
    note: body.note,
    tags: body.tags,
  }
}

const recentTransactionDirectionSchema = z.enum(["debit", "credit"])

/** GET /transactions/recent — each row in `data.transactions` */
export const recentTransactionItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    subtitle: z.string().optional().default(""),
    type: transactionTypeSchema,
    direction: recentTransactionDirectionSchema.optional(),
    amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
    signedAmount: z.union([z.string(), z.number()]).transform((v) => String(v)),
    date: z.string(),
    paymentMethod: z.string().optional(),
    sourceName: z.string().optional(),
    accountId: z.string().optional(),
  })
  .passthrough()

export type RecentTransaction = z.infer<typeof recentTransactionItemSchema>

const recentTransactionsSuccessSchema = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.object({
    transactions: z.array(recentTransactionItemSchema),
  }),
})

export function parseGetRecentTransactionsSuccess(
  raw: unknown
): { ok: true; transactions: RecentTransaction[] } | { ok: false; error: string } {
  const parsed = recentTransactionsSuccessSchema.safeParse(raw)
  if (parsed.success) {
    return { ok: true, transactions: parsed.data.data.transactions }
  }
  return { ok: false, error: "Invalid recent transactions response." }
}

/** Parse `signedAmount` / `amount` string to a finite number (handles commas, leading sign). */
export function parseSignedAmountString(s: string): number {
  const n = Number(String(s).replace(/,/g, "").replace(/\s/g, ""))
  return Number.isFinite(n) ? n : 0
}
