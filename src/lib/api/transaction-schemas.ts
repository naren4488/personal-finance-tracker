import { z } from "zod"
import type { CreateTransactionPayload, Transaction } from "@/lib/api/schemas"
import { transactionTypeSchema } from "@/lib/api/schemas"

/** POST /transactions — income (matches backend contract). */
export const createTransactionIncomeBodySchema = z.object({
  type: z.literal("income"),
  amount: z.string().min(1),
  incomeSource: z.string().min(1),
  accountId: z.string().min(1),
  date: z.string(),
  note: z.string(),
  tags: z.array(z.string()),
})

/** POST /transactions — expense. */
export const createTransactionExpenseBodySchema = z.object({
  type: z.literal("expense"),
  amount: z.string().min(1),
  category: z.string().min(1),
  accountId: z.string().min(1),
  date: z.string(),
  note: z.string(),
  tags: z.array(z.string()),
})

/** POST /transactions — transfer between accounts. */
export const createTransactionTransferBodySchema = z.object({
  type: z.literal("transfer"),
  amount: z.string().min(1),
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  date: z.string(),
  note: z.string(),
  tags: z.array(z.string()),
})

export const createTransactionApiBodySchema = z.discriminatedUnion("type", [
  createTransactionIncomeBodySchema,
  createTransactionExpenseBodySchema,
  createTransactionTransferBodySchema,
])

export type CreateTransactionApiBody = z.infer<typeof createTransactionApiBodySchema>

export const INCOME_SOURCE_OPTIONS = [
  { value: "salary", label: "Salary" },
  { value: "freelance", label: "Freelance" },
  { value: "investment", label: "Investment" },
  { value: "gift", label: "Gift" },
  { value: "business", label: "Business" },
  { value: "other", label: "Other" },
] as const

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
  accountId: z.string().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  incomeSource: z.string().optional(),
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

  const accountIdFromApi =
    typeof t.accountId === "string"
      ? t.accountId
      : typeof t.fromAccountId === "string"
        ? t.fromAccountId
        : fallback.accountId

  return {
    id,
    title: title.trim() || "Transaction",
    amount,
    type,
    date,
    category: category || undefined,
    accountId: accountIdFromApi,
    accountName: sourceName || fallback.accountName,
  }
}

function amountToApiString(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0"
  return String(Math.round(amount * 100) / 100)
}

/**
 * Maps client payload → exact POST /transactions JSON per `type`.
 * Only fields the backend expects are included (no paymentMethod, etc.).
 */
export function buildTransactionPostBody(body: CreateTransactionPayload): CreateTransactionApiBody {
  const amount = amountToApiString(body.amount)
  const date = body.date
  const note = body.note
  const tags = body.tags

  if (body.type === "income") {
    if (!body.accountId) {
      throw new Error("income requires accountId")
    }
    return {
      type: "income",
      amount,
      incomeSource: (body.incomeSource ?? "other").trim() || "other",
      accountId: body.accountId,
      date,
      note,
      tags,
    }
  }

  if (body.type === "expense") {
    if (!body.accountId) {
      throw new Error("expense requires accountId")
    }
    return {
      type: "expense",
      amount,
      category: body.category.trim() || "other",
      accountId: body.accountId,
      date,
      note,
      tags,
    }
  }

  if (!body.accountId || !body.toAccountId) {
    throw new Error("transfer requires accountId (from) and toAccountId")
  }
  return {
    type: "transfer",
    amount,
    fromAccountId: body.accountId,
    toAccountId: body.toAccountId,
    date,
    note,
    tags,
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
