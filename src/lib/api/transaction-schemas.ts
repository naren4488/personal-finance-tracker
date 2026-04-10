import { z } from "zod"
import type { Account } from "@/lib/api/account-schemas"
import { accountSelectLabel } from "@/lib/api/account-schemas"
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
    toAccountId: z.string().optional(),
  })
  .passthrough()

export type RecentTransaction = z.infer<typeof recentTransactionItemSchema>

function extractRecentTransactionsArray(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw
  if (raw === null || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>

  const data = o.data
  if (Array.isArray(data)) return data
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>
    const keys = ["transactions", "items", "recentTransactions", "records"] as const
    for (const k of keys) {
      const v = d[k]
      if (Array.isArray(v)) return v
    }
    const inner = d.data
    if (Array.isArray(inner)) return inner
  }
  return null
}

/** Drop list rows that are account objects (loan / card) mistakenly mixed into a feed. */
function shouldExcludeAsNonTransactionRow(rec: Record<string, unknown>): boolean {
  const kind = typeof rec.kind === "string" ? rec.kind.trim().toLowerCase() : ""
  if (kind === "loan" || kind === "credit_card") return true

  const looksLikeLoanAccount =
    rec.lenderName != null &&
    (rec.loanType != null || rec.loanAccountNumber != null || rec.principalAmount != null)
  if (looksLikeLoanAccount && rec.type == null && rec.category == null && rec.title == null) {
    return true
  }

  const looksLikeCreditCardAccount =
    rec.cardNetwork != null &&
    rec.creditLimit != null &&
    (rec.last4Digits != null || rec.billGenerationDay != null)
  if (looksLikeCreditCardAccount && rec.type == null && rec.category == null && rec.title == null) {
    return true
  }

  return false
}

function normalizeRecentType(v: unknown): "income" | "expense" | "transfer" {
  const s = typeof v === "string" ? v.trim().toLowerCase() : ""
  if (s === "income" || s === "expense" || s === "transfer") return s
  return "expense"
}

function normalizeRecentSignedAmount(rec: Record<string, unknown>): string {
  const signed = rec.signedAmount
  if (signed !== undefined && signed !== null) {
    return String(signed).replace(/\s/g, "").trim() || "0"
  }
  const rawAmt = rec.amount
  const amtStr =
    rawAmt !== undefined && rawAmt !== null
      ? String(rawAmt).replace(/,/g, "").replace(/\s/g, "").trim()
      : "0"
  const dir = typeof rec.direction === "string" ? rec.direction.trim().toLowerCase() : ""
  if (!amtStr || amtStr === "0") return "0"
  const hasSign = amtStr.startsWith("-") || amtStr.startsWith("+")
  if (hasSign) return amtStr
  if (dir === "debit") return amtStr.startsWith("-") ? amtStr : `-${amtStr}`
  if (dir === "credit") return amtStr.startsWith("-") ? amtStr.slice(1) : amtStr
  return amtStr
}

function normalizeRecentTitle(rec: Record<string, unknown>): string {
  const keys = ["title", "description", "note", "category", "sourceName", "merchantName"] as const
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return "Transaction"
}

function normalizeRecentDate(rec: Record<string, unknown>): string | null {
  const d = rec.date
  if (typeof d === "string" && d.trim()) {
    const t = d.trim()
    return t.length >= 10 ? t.slice(0, 10) : t
  }
  const c = rec.createdAt
  if (typeof c === "string" && c.includes("T")) return c.slice(0, 10)
  return null
}

function normalizeRawToRecentTransaction(rec: Record<string, unknown>): RecentTransaction | null {
  const date = normalizeRecentDate(rec)
  if (!date) return null

  const id = rec.id !== undefined && rec.id !== null ? String(rec.id).trim() : crypto.randomUUID()
  const title = normalizeRecentTitle(rec)
  const subtitle =
    typeof rec.subtitle === "string"
      ? rec.subtitle
      : typeof rec.paymentMethod === "string"
        ? rec.paymentMethod
        : ""

  const type = normalizeRecentType(rec.type)
  const directionParsed = recentTransactionDirectionSchema.safeParse(rec.direction)
  const direction = directionParsed.success ? directionParsed.data : undefined

  const signedAmount = normalizeRecentSignedAmount(rec)
  const amountStr =
    rec.amount !== undefined && rec.amount !== null
      ? String(rec.amount).replace(/,/g, "").replace(/\s/g, "").trim()
      : signedAmount

  const paymentMethod = typeof rec.paymentMethod === "string" ? rec.paymentMethod : undefined
  const sourceName = typeof rec.sourceName === "string" ? rec.sourceName : undefined
  const accountId =
    typeof rec.accountId === "string"
      ? rec.accountId
      : typeof rec.sourceAccountId === "string"
        ? rec.sourceAccountId
        : typeof rec.fromAccountId === "string"
          ? rec.fromAccountId
          : undefined

  const toAccountId =
    typeof rec.toAccountId === "string" && rec.toAccountId.trim()
      ? rec.toAccountId.trim()
      : undefined

  return {
    id,
    title,
    subtitle,
    type,
    direction,
    amount: amountStr,
    signedAmount,
    date,
    paymentMethod,
    sourceName,
    accountId,
    toAccountId,
  } as RecentTransaction
}

export function parseGetRecentTransactionsSuccess(
  raw: unknown
): { ok: true; transactions: RecentTransaction[] } | { ok: false; error: string } {
  const strict = z
    .object({
      success: z.literal(true),
      message: z.string().optional(),
      data: z.object({
        transactions: z.array(recentTransactionItemSchema),
      }),
    })
    .safeParse(raw)
  if (strict.success) {
    const txs = strict.data.data.transactions.filter(
      (t) => !shouldExcludeAsNonTransactionRow(t as unknown as Record<string, unknown>)
    )
    return { ok: true, transactions: txs }
  }

  const arr = extractRecentTransactionsArray(raw)
  if (arr === null) {
    return { ok: false, error: "Invalid recent transactions response." }
  }

  const out: RecentTransaction[] = []
  let excluded = 0
  for (const item of arr) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const rec = item as Record<string, unknown>
    if (shouldExcludeAsNonTransactionRow(rec)) {
      excluded += 1
      continue
    }
    const row = normalizeRawToRecentTransaction(rec)
    if (row) out.push(row)
  }

  if (import.meta.env.DEV && excluded > 0) {
    console.warn(
      "[transactions] GET recent — excluded",
      excluded,
      "row(s) that look like accounts, not transactions"
    )
  }

  return { ok: true, transactions: out }
}

/** Parse `signedAmount` / `amount` string to a finite number (handles commas, leading sign). */
export function parseSignedAmountString(s: string): number {
  const n = Number(String(s).replace(/,/g, "").replace(/\s/g, ""))
  return Number.isFinite(n) ? n : 0
}

/** Heuristic Udhar detection from recent row text until backend adds explicit tags. */
export function isUdharRecentTransaction(tx: RecentTransaction): boolean {
  const hay = `${tx.title} ${tx.subtitle} ${tx.sourceName ?? ""}`.toLowerCase()
  return (
    hay.includes("udhar") ||
    hay.includes("borrow") ||
    hay.includes("lent") ||
    hay.includes("money given") ||
    hay.includes("money taken") ||
    hay.includes("payment received") ||
    hay.includes("payment made")
  )
}

export function udharDirectionLabel(tx: RecentTransaction): "given" | "taken" {
  const n = parseSignedAmountString(tx.signedAmount)
  if (n < 0) return "given"
  if (n > 0) return "taken"
  if (tx.direction === "debit") return "given"
  return "taken"
}

export function inferUdharPersonKey(tx: RecentTransaction): string {
  const sub = tx.subtitle.trim()
  if (sub) return sub.toLowerCase()
  const title = tx.title.trim()
  if (title) return title.toLowerCase()
  return tx.id
}

export function inferUdharPersonName(tx: RecentTransaction): string {
  const rec = tx as unknown as Record<string, unknown>
  if (typeof rec.personName === "string" && rec.personName.trim()) {
    return rec.personName.trim()
  }
  if (tx.subtitle.trim()) return tx.subtitle.trim()
  if (tx.title.trim()) return tx.title.trim()
  return "Unknown"
}

function accountKindIsLoanOrCard(account: Account | undefined): boolean {
  if (!account) return false
  const k = String(account.kind ?? account.type ?? "")
    .trim()
    .toLowerCase()
  return k === "loan" || k === "credit_card" || k === "creditcard"
}

/** Hide income/expense/transfer rows that are tied to loan or credit card accounts (Accounts module owns those). */
export function isRecentTransactionLinkedToLoanOrCard(
  tx: RecentTransaction,
  accounts: Account[]
): boolean {
  const byId = new Map(accounts.map((a) => [String(a.id), a]))
  const ids = [tx.accountId, tx.toAccountId].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0
  )
  for (const id of ids) {
    if (accountKindIsLoanOrCard(byId.get(id))) return true
  }
  return false
}

export function getTransferRouteLabels(
  tx: RecentTransaction,
  accounts: Account[]
): { fromLabel: string; toLabel: string } {
  const byId = new Map(accounts.map((a) => [String(a.id), a]))
  const toId =
    typeof tx.toAccountId === "string" && tx.toAccountId.trim() ? tx.toAccountId.trim() : undefined
  const fromId = tx.accountId?.trim()
  const fromA = fromId ? byId.get(fromId) : undefined
  const toA = toId ? byId.get(toId) : undefined
  return {
    fromLabel: fromA ? accountSelectLabel(fromA) : fromId ? "Unknown account" : "—",
    toLabel: toA ? accountSelectLabel(toA) : toId ? "Unknown account" : "—",
  }
}
