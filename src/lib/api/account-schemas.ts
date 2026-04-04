import { z } from "zod"

export const accountSchema = z.object({
  id: z.string(),
  name: z.string(),
})

export type Account = z.infer<typeof accountSchema>

const envelopeWithAccountsKey = z.object({
  success: z.literal(true),
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

export type CreateAccountRequest = {
  name: string
  accountType: string
  initialBalanceInr: number
  emiLoan?: AccountEmiLoanPayload
}

/**
 * Default **snake_case** (typical Go `json` tags). Set `VITE_ACCOUNTS_CAMEL_CASE=true` for camelCase
 * (same style as POST /transactions).
 */
function accountsUseCamelCaseJson(): boolean {
  const v = import.meta.env.VITE_ACCOUNTS_CAMEL_CASE
  return String(v).toLowerCase() === "true" || v === "1"
}

/**
 * Default **numeric** JSON for INR fields (strings often fail `float64` unmarshaling).
 * Set `VITE_ACCOUNTS_STRING_AMOUNTS=true` to send amounts as strings.
 */
function accountsUseStringAmounts(): boolean {
  const v = import.meta.env.VITE_ACCOUNTS_STRING_AMOUNTS
  return String(v).toLowerCase() === "true" || v === "1"
}

function n(v: number, asString: boolean): number | string {
  return asString ? String(v) : v
}

function emiLoanToSnakeCase(
  emi: AccountEmiLoanPayload,
  asString: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    principal_inr: n(emi.principalInr, asString),
    interest_rate_percent: n(emi.interestRatePercent, asString),
    tenure_months: n(emi.tenureMonths, asString),
    start_date: emi.startDate,
    emi_due_day: n(emi.emiDueDay, asString),
    due_date_cycle: emi.dueDateCycle,
    override_emi: emi.overrideEmi,
  }
  if (emi.bankLender?.trim()) out.bank_lender = emi.bankLender.trim()
  if (emi.loanAccountNo?.trim()) out.loan_account_no = emi.loanAccountNo.trim()
  if (emi.overrideEmi && emi.customEmiAmountInr !== undefined) {
    out.custom_emi_amount_inr = n(emi.customEmiAmountInr, asString)
  }
  return out
}

function emiLoanToCamelCase(
  emi: AccountEmiLoanPayload,
  asString: boolean
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    principalInr: n(emi.principalInr, asString),
    interestRatePercent: n(emi.interestRatePercent, asString),
    tenureMonths: n(emi.tenureMonths, asString),
    startDate: emi.startDate,
    emiDueDay: n(emi.emiDueDay, asString),
    dueDateCycle: emi.dueDateCycle,
    overrideEmi: emi.overrideEmi,
  }
  if (emi.bankLender?.trim()) out.bankLender = emi.bankLender.trim()
  if (emi.loanAccountNo?.trim()) out.loanAccountNo = emi.loanAccountNo.trim()
  if (emi.overrideEmi && emi.customEmiAmountInr !== undefined) {
    out.customEmiAmountInr = n(emi.customEmiAmountInr, asString)
  }
  return out
}

/**
 * JSON body for POST /accounts.
 * - Default: **snake_case** + **numeric** amounts (common for Go backends).
 * - `VITE_ACCOUNTS_CAMEL_CASE=true` → camelCase keys.
 * - `VITE_ACCOUNTS_STRING_AMOUNTS=true` → amount fields as strings.
 */
export function buildCreateAccountPostBody(body: CreateAccountRequest): Record<string, unknown> {
  const name = body.name.trim()
  const forceSnake = !accountsUseCamelCaseJson()
  const asString = accountsUseStringAmounts()

  if (!forceSnake) {
    const payload: Record<string, unknown> = {
      name,
      accountType: body.accountType,
      initialBalanceInr: n(body.initialBalanceInr, asString),
    }
    if (body.emiLoan) payload.emiLoan = emiLoanToCamelCase(body.emiLoan, asString)
    return payload
  }

  const payload: Record<string, unknown> = {
    name,
    account_type: body.accountType,
    initial_balance_inr: n(body.initialBalanceInr, asString),
  }
  if (body.emiLoan) {
    payload.emi_loan = emiLoanToSnakeCase(body.emiLoan, asString)
  }
  return payload
}

export function parseCreateAccountSuccess(
  raw: unknown
): { ok: true; account: Account } | { ok: false; error: string } {
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
  return { ok: false, error: "Invalid create account response." }
}
