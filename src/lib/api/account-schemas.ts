import { z } from "zod"

/** Single account from API (GET list / POST create); relaxed so varied backends parse. */
export const accountSchema = z
  .object({
    id: z.coerce.string(),
    name: z.coerce.string(),
    kind: z.string().optional(),
    type: z.string().optional(),
    balance: z.union([z.string(), z.number()]).optional(),
    openingBalance: z.union([z.string(), z.number()]).optional(),
    bankName: z.string().optional(),
    provider: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .passthrough()

export type Account = z.infer<typeof accountSchema>

const envelopeWithAccountsKey = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.object({
    accounts: z.array(accountSchema),
  }),
})

const envelopeDataArray = z.object({
  success: z.literal(true),
  data: z.array(accountSchema),
})

export function parseGetAccountsSuccess(
  raw: unknown
): { ok: true; accounts: Account[] } | { ok: false; error: string } {
  const a = envelopeWithAccountsKey.safeParse(raw)
  if (a.success) {
    return { ok: true, accounts: a.data.data.accounts }
  }
  const b = envelopeDataArray.safeParse(raw)
  if (b.success) {
    return { ok: true, accounts: b.data.data }
  }
  const direct = z.array(accountSchema).safeParse(raw)
  if (direct.success) {
    return { ok: true, accounts: direct.data }
  }
  return { ok: false, error: "Invalid accounts response." }
}

/** Numeric INR from `balance` or `openingBalance` (string or number from API). */
export function accountBalanceInrFromApi(
  account: Pick<Account, "balance" | "openingBalance">
): number {
  const raw = account.balance ?? account.openingBalance
  if (raw === undefined || raw === null) return 0
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0
  const n = Number(String(raw).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}

/** Secondary line for lists: bank + kind/type. */
export function accountSubtitleForList(account: Account): string | undefined {
  const bank = account.bankName?.trim() || account.provider?.trim()
  const kind = account.kind?.trim() || account.type?.trim()
  const parts = [bank, kind].filter(Boolean)
  return parts.length ? parts.join(" · ") : undefined
}

/** Dropdown / filter label. */
export function accountSelectLabel(account: Account): string {
  const sub = accountSubtitleForList(account)
  return sub ? `${account.name} (${sub})` : account.name
}

/** Treat missing `isActive` as active. */
export function filterActiveAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.isActive !== false)
}

export type AccountEmiLoanPayload = {
  bankLender?: string
  loanAccountNo?: string
  principalInr: number
  interestRatePercent: number
  tenureMonths: number
  startDate: string
  emiDueDay: number
  dueDateCycle: "fixed" | "rolling"
  overrideEmi: boolean
  customEmiAmountInr?: number
}

/**
 * Client-side values before building POST JSON (openingBalance is formatted in the builder).
 */
export type CreateAccountRequest = {
  name: string
  kind: string
  balanceInr: number
  bankName: string
  isActive: boolean
  cardNetwork?: string
  last4Digits?: string
  creditLimitInr?: number
  billGenerationDay?: number
  paymentDueDay?: number
}

export type CreateAccountResult = {
  account?: Account
  message?: string
}

/** API expects `openingBalance` as a string with two decimals (e.g. "312586.00"). */
export function formatOpeningBalanceForApi(balanceInr: number): string {
  const n = Number.isFinite(balanceInr) ? balanceInr : 0
  const rounded = Math.round(n * 100) / 100
  return rounded.toFixed(2)
}

/**
 * JSON body for POST /api/v1/accounts — keys must match backend exactly.
 */
export function buildCreateAccountPostBody(body: CreateAccountRequest): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: body.name.trim(),
    kind: body.kind,
    openingBalance: formatOpeningBalanceForApi(body.balanceInr),
    bankName: body.bankName.trim(),
    isActive: body.isActive,
  }

  if (body.kind === "credit_card") {
    const network = body.cardNetwork?.trim().toLowerCase()
    const last4 = body.last4Digits?.replace(/\D/g, "")
    const limit = Number.isFinite(body.creditLimitInr) ? Math.max(0, body.creditLimitInr ?? 0) : 0
    const billDay = Number.isFinite(body.billGenerationDay)
      ? Math.trunc(body.billGenerationDay ?? 0)
      : 0
    const dueDay = Number.isFinite(body.paymentDueDay) ? Math.trunc(body.paymentDueDay ?? 0) : 0

    if (!network) throw new Error("cardNetwork is required for credit cards")
    if (!last4 || last4.length !== 4) throw new Error("last4Digits must be exactly 4 digits")
    if (!Number.isFinite(limit) || limit <= 0)
      throw new Error("creditLimit must be a positive value")
    if (billDay < 1 || billDay > 31) throw new Error("billGenerationDay must be between 1 and 31")
    if (dueDay < 1 || dueDay > 31) throw new Error("paymentDueDay must be between 1 and 31")

    base.cardNetwork = network
    base.last4Digits = last4
    base.creditLimit = formatOpeningBalanceForApi(limit)
    base.billGenerationDay = String(billDay)
    base.paymentDueDay = String(dueDay)
  }

  return base
}

const createAccountSuccessEnvelope = z.object({
  success: z.literal(true),
  message: z.string().optional(),
  data: z.object({ account: accountSchema }),
})

export function parseCreateAccountSuccess(
  raw: unknown
): { ok: true; account?: Account; message?: string } | { ok: false; error: string } {
  const envelope = createAccountSuccessEnvelope.safeParse(raw)
  if (envelope.success) {
    return {
      ok: true,
      account: envelope.data.data.account,
      message: envelope.data.message,
    }
  }
  const direct = accountSchema.safeParse(raw)
  if (direct.success) {
    return { ok: true, account: direct.data }
  }
  const wrapped = z
    .object({
      success: z.literal(true),
      data: accountSchema,
    })
    .safeParse(raw)
  if (wrapped.success) {
    return { ok: true, account: wrapped.data.data }
  }
  const nested = z
    .object({
      data: z.object({ account: accountSchema }),
    })
    .safeParse(raw)
  if (nested.success) {
    return { ok: true, account: nested.data.data.account }
  }
  const successMessageOnly = z
    .object({
      success: z.literal(true),
      message: z.string().optional(),
    })
    .safeParse(raw)
  if (successMessageOnly.success) {
    return { ok: true, message: successMessageOnly.data.message }
  }
  return { ok: false, error: "Invalid create account response." }
}
