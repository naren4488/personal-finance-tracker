import { z } from "zod"

/** Single account from API (GET list / POST create); relaxed so varied backends parse. */
export const accountSchema = z
  .object({
    id: z.coerce.string(),
    name: z.coerce.string(),
    kind: z.string().optional(),
    type: z.string().optional(),
    balance: z.union([z.string(), z.number()]).optional(),
    /** Live balance from API (GET /accounts) — preferred for “available” display. */
    currentBalance: z.union([z.string(), z.number()]).optional(),
    /** Spendable / ledger balance when API sends it separately from `openingBalance`. */
    availableBalance: z.union([z.string(), z.number()]).optional(),
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

function parseMoneyScalar(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null
  const n = Number(String(raw).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : null
}

/**
 * Numeric INR the user can spend / see as “available” when the API sends it.
 * Prefers `currentBalance` (typical GET /accounts live balance), then other aliases, then `balance` / `openingBalance`.
 */
export function accountAvailableBalanceInrFromApi(account: Account): number {
  const r = account as Record<string, unknown>
  const keys = [
    "currentBalance",
    "current_balance",
    "availableBalance",
    "available_balance",
    "availableAmount",
    "currentAvailableBalance",
    "clearBalance",
    "spendableBalance",
    "effectiveBalance",
  ] as const
  for (const k of keys) {
    const n = parseMoneyScalar(r[k])
    if (n != null) return n
  }
  return accountBalanceInrFromApi(account)
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

/** Opening balance only (not falling back to `balance`). */
export function openingBalanceInrFromApi(account: Pick<Account, "openingBalance">): number {
  const raw = account.openingBalance
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

/** Prefer `type`, then `kind` — for mapping expense `sourceType` and `payFromAccountType`. */
export function accountApiTypeOrKind(account: Pick<Account, "type" | "kind">): string {
  const t = String(account.type ?? "")
    .trim()
    .toLowerCase()
  if (t) return t
  return String(account.kind ?? "")
    .trim()
    .toLowerCase()
}

/** Treat missing `isActive` as active. */
export function filterActiveAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => a.isActive !== false)
}

/** Accounts list segment: bank/cash/wallet/etc. — exclude loans and credit cards. */
export function filterNormalAccounts(accounts: Account[]): Account[] {
  return accounts.filter((a) => {
    const k = String(a.kind ?? "")
      .trim()
      .toLowerCase()
    return k !== "credit_card" && k !== "loan"
  })
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
  /** `kind === "loan"` — API slug, e.g. `personal`, `home` */
  loanType?: string
  /** `kind === "loan"` — required by API (same as bank/lender in UI) */
  lenderName?: string
  loanAccountNumber?: string
  principalAmountInr?: number
  /** Sent as string in POST body, e.g. `"8.5"` */
  interestRate?: string
  tenureMonths?: number
  startDate?: string
  emiDueDay?: number
  dueDateCycle?: "fixed" | "rolling"
  overrideEmiAmountOn?: boolean
  /** Required when `overrideEmiAmountOn` is true — sent as `overrideEmiAmount` (MoneyValue). */
  overrideEmiAmountInr?: number
}

/** Map UI loan type label to POST `loanType` slug. */
export function loanTypeLabelToApiSlug(label: string): string {
  const map: Record<string, string> = {
    "Personal Loan": "personal",
    "Home Loan": "home",
    "Vehicle Loan": "vehicle",
    "Education Loan": "education",
    "Business Loan": "business",
    "Gold Loan": "gold",
    Other: "other",
  }
  const fallback = label.trim().toLowerCase().replace(/\s+/g, "_") || "other"
  return map[label] ?? fallback
}

/** Wire values for loan `dueDateCycle` (server accepts only these, e.g. `fixed_monthly_date` | `rolling_30_day_cycle`). */
export const LOAN_DUE_DATE_CYCLE_WIRE = {
  fixed: "fixed_monthly_date",
  rolling: "rolling_30_day_cycle",
} as const

/**
 * Map a stored or UI `dueDateCycle` string to the value the API accepts on POST/PUT.
 * Accepts short `rolling` / `fixed_monthly_date` / `rolling_30_day_cycle` and similar.
 */
export function normalizeLoanDueDateCycleForApi(
  raw: string
): (typeof LOAN_DUE_DATE_CYCLE_WIRE)[keyof typeof LOAN_DUE_DATE_CYCLE_WIRE] {
  const s = raw.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_")
  if (!s) return LOAN_DUE_DATE_CYCLE_WIRE.fixed
  if (s.includes("fixed") && (s.includes("month") || s.includes("monthly"))) {
    return LOAN_DUE_DATE_CYCLE_WIRE.fixed
  }
  if (s === "rolling" || s.startsWith("rolling_")) {
    return LOAN_DUE_DATE_CYCLE_WIRE.rolling
  }
  return LOAN_DUE_DATE_CYCLE_WIRE.fixed
}

function dueDateCycleForApi(cycle: "fixed" | "rolling"): string {
  return cycle === "fixed" ? LOAN_DUE_DATE_CYCLE_WIRE.fixed : LOAN_DUE_DATE_CYCLE_WIRE.rolling
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

  if (body.kind === "loan") {
    const lender = (body.lenderName ?? body.bankName).trim()
    if (!lender) throw new Error("lenderName is required for loans")

    const principal = body.principalAmountInr
    if (principal == null || !Number.isFinite(principal) || principal <= 0) {
      throw new Error("principalAmount must be a positive value")
    }

    const tenure = body.tenureMonths
    if (tenure == null || !Number.isFinite(tenure) || tenure < 1) {
      throw new Error("tenureMonths must be a positive integer")
    }

    const startDate = (body.startDate ?? "").trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      throw new Error("startDate must be YYYY-MM-DD")
    }

    const emiDay = Number.isFinite(body.emiDueDay) ? Math.trunc(body.emiDueDay ?? 0) : 0
    if (emiDay < 1 || emiDay > 31) throw new Error("emiDueDay must be between 1 and 31")

    const cycle = body.dueDateCycle === "rolling" ? "rolling" : "fixed"
    const rateStr = (body.interestRate ?? "").trim() || "0"
    const loanType = (body.loanType ?? "personal").trim().toLowerCase() || "personal"
    const acctNo = body.loanAccountNumber?.trim()

    base.bankName = lender
    base.loanType = loanType
    base.lenderName = lender
    if (acctNo) base.loanAccountNumber = acctNo
    base.principalAmount = formatOpeningBalanceForApi(principal)
    base.interestRate = rateStr
    base.tenureMonths = Math.trunc(tenure)
    base.startDate = startDate
    base.emiDueDay = String(emiDay)
    base.dueDateCycle = dueDateCycleForApi(cycle)
    base.overrideEmiAmountOn = Boolean(body.overrideEmiAmountOn)
    if (body.overrideEmiAmountOn) {
      const ov = body.overrideEmiAmountInr
      if (ov == null || !Number.isFinite(ov) || ov <= 0) {
        throw new Error("overrideEmiAmount must be a positive value when override EMI is on")
      }
      base.overrideEmiAmount = formatOpeningBalanceForApi(ov)
    }

    /** Some APIs expect both `openingBalance` (set in base) and `balance` for loan accounts. */
    const loanOpening = formatOpeningBalanceForApi(body.balanceInr)
    base.balance = loanOpening
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

/**
 * DELETE /accounts/:id — 200 with optional JSON body, or empty body.
 */
export function parseDeleteAccountApiSuccess(
  raw: unknown
): { ok: true; message?: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, message: "Deleted" }
  }
  if (typeof raw !== "object" || raw === null) {
    return { ok: true }
  }
  const r = raw as Record<string, unknown>
  if (r.success === false) {
    const m =
      typeof r.message === "string" && r.message.trim() ? r.message.trim() : "Failed to delete"
    return { ok: false, error: m }
  }
  if (r.success === true) {
    const m = typeof r.message === "string" && r.message.trim() ? r.message.trim() : undefined
    return { ok: true, message: m }
  }
  return { ok: true }
}
