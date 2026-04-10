import type { Account } from "@/lib/api/account-schemas"
import { accountBalanceInrFromApi } from "@/lib/api/account-schemas"
import { formatDate } from "@/lib/format"

function parseMoney(v: unknown): number {
  if (v === undefined || v === null) return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const n = Number(String(v).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}

function asRec(a: Account): Record<string, unknown> {
  return a as unknown as Record<string, unknown>
}

/** Outstanding / used amount: prefer explicit credit-card fields, else balance/openingBalance. */
export function creditCardOutstandingInr(a: Account): number {
  const r = asRec(a)
  const o = r.currentOutstanding ?? r.outstanding ?? r.outstandingBalance
  if (o !== undefined && o !== null) return parseMoney(o)
  return accountBalanceInrFromApi(a)
}

export function creditCardLimitInr(a: Account): number {
  return parseMoney(asRec(a).creditLimit)
}

/**
 * Minimum amount due for the current billing cycle when the API provides it.
 * Falls back to `minDuePercent` (or similar) × outstanding when present.
 */
export function creditCardMinimumPaymentInr(a: Account): number | null {
  const r = asRec(a)
  const explicitKeys = [
    "minimumDue",
    "minimumPaymentDue",
    "minPaymentDue",
    "minimumPayment",
    "minDueAmount",
    "nextMinimumPayment",
    "minimumPaymentAmount",
    "min_payment_due",
    "minimum_payment_due",
    "minDue",
  ] as const
  for (const k of explicitKeys) {
    const v = r[k]
    if (v === undefined || v === null) continue
    const n = parseMoney(v)
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100
  }
  const pctRaw = r.minDuePercent ?? r.minimumDuePercent ?? r.minimumDuePercentage ?? r.minDuePct
  if (pctRaw === undefined || pctRaw === null) return null
  const pct = typeof pctRaw === "number" ? pctRaw : Number(String(pctRaw).replace(/,/g, "").trim())
  if (!Number.isFinite(pct) || pct <= 0) return null
  const out = creditCardOutstandingInr(a)
  if (!(out > 0)) return null
  const due = (out * pct) / 100
  if (!Number.isFinite(due) || due <= 0) return null
  return Math.round(due * 100) / 100
}

export function paymentDueDayNumber(a: Account): number | null {
  const r = asRec(a)
  const d = r.paymentDueDay
  if (d === undefined || d === null) return null
  const n = typeof d === "number" ? d : Number(String(d).replace(/\D/g, ""))
  if (!Number.isFinite(n)) return null
  const day = Math.trunc(n)
  if (day < 1 || day > 31) return null
  return day
}

function lastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** Next calendar date on `day` (clamped to month length), on or after today (local). */
export function nextDueDateFromDay(day: number, now = new Date()): Date {
  const y = now.getFullYear()
  const m = now.getMonth()
  const today = now.getDate()
  const clamp = (yy: number, mm: number) => Math.min(day, lastDayOfMonth(yy, mm))

  const thisMonthDue = clamp(y, m)
  if (today <= thisMonthDue) {
    return new Date(y, m, thisMonthDue)
  }
  const nextM = m + 1
  if (nextM <= 11) {
    return new Date(y, nextM, clamp(y, nextM))
  }
  return new Date(y + 1, 0, clamp(y + 1, 0))
}

export function formatPaymentDueFromAccount(a: Account): string | null {
  const d = paymentDueDayNumber(a)
  if (d === null) return null
  return formatDate(nextDueDateFromDay(d))
}

export type CreditCardViewModel = {
  id: string
  name: string
  bankName: string
  cardNetwork?: string
  last4Digits?: string
  creditLimit: number
  outstanding: number
  usedPercent: number
  dueDateLabel: string | null
}

export function mapAccountToCreditCardView(a: Account): CreditCardViewModel {
  const r = asRec(a)
  const limit = creditCardLimitInr(a)
  const outstanding = creditCardOutstandingInr(a)
  const usedPercent =
    limit > 0 ? Math.min(100, Math.max(0, Math.round((100 * outstanding) / limit))) : 0

  const bank =
    typeof r.bankName === "string" && r.bankName.trim()
      ? r.bankName.trim()
      : typeof a.bankName === "string" && a.bankName.trim()
        ? a.bankName.trim()
        : ""

  const network =
    typeof r.cardNetwork === "string" && r.cardNetwork.trim() ? r.cardNetwork.trim() : undefined
  const last4 =
    typeof r.last4Digits === "string" && r.last4Digits.trim() ? r.last4Digits.trim() : undefined

  return {
    id: a.id,
    name: a.name,
    bankName: bank,
    cardNetwork: network,
    last4Digits: last4,
    creditLimit: limit,
    outstanding,
    usedPercent,
    dueDateLabel: formatPaymentDueFromAccount(a),
  }
}

export function isCreditCardAccount(a: Account): boolean {
  const k = `${a.kind ?? a.type ?? ""}`.toLowerCase().replace(/\s+/g, "_")
  return k === "credit_card" || k === "creditcard"
}

export function billGenerationDayNumber(a: Account): number | null {
  const r = asRec(a)
  const d = r.billGenerationDay
  if (d === undefined || d === null) return null
  const n = typeof d === "number" ? d : Number(String(d).replace(/\D/g, ""))
  if (!Number.isFinite(n)) return null
  const day = Math.trunc(n)
  if (day < 1 || day > 31) return null
  return day
}

/** e.g. 1 → "1st", 22 → "22nd" */
export function dayOfMonthOrdinal(day: number): string {
  const d = Math.trunc(day)
  if (d < 1 || d > 31) return String(day)
  const j = d % 10
  const k = d % 100
  if (k >= 11 && k <= 13) return `${d}th`
  if (j === 1) return `${d}st`
  if (j === 2) return `${d}nd`
  if (j === 3) return `${d}rd`
  return `${d}th`
}

export function billCycleLabelFromDay(day: number | null): string | null {
  if (day === null) return null
  return `${dayOfMonthOrdinal(day)} of month`
}

/** `•••• •••• •••• 1234` when last4 is 4 digits */
export function maskedCardNumberDisplay(last4Digits: string | undefined): string | null {
  const d = last4Digits?.replace(/\D/g, "").slice(-4)
  if (!d || d.length !== 4) return null
  return `•••• •••• •••• ${d}`
}

export function interestRatePercentFromAccount(a: Account): number | null {
  const r = asRec(a)
  const keys = ["interestRate", "apr", "interestRatePercent", "rate"] as const
  for (const k of keys) {
    const v = r[k]
    if (v === undefined || v === null) continue
    const n = typeof v === "number" ? v : parseFloat(String(v).replace(/%/g, "").trim())
    if (Number.isFinite(n) && n >= 0) return n
  }
  return null
}

export function accountStatusLabel(a: Account): string | null {
  const r = asRec(a)
  const s = r.status
  if (typeof s !== "string" || !s.trim()) return null
  return s.trim()
}

export function accountCreatedAtLabel(a: Account): string | null {
  const r = asRec(a)
  const c = r.createdAt
  if (typeof c !== "string" || !c.trim()) return null
  const t = c.includes("T") ? c.slice(0, 10) : c.trim()
  try {
    return formatDate(t.length >= 10 ? t : c)
  } catch {
    return c.trim()
  }
}

export function currentOutstandingPrincipalInr(a: Account): number | null {
  const r = asRec(a)
  const v = r.currentOutstandingPrincipal
  if (v === undefined || v === null) return null
  const n = parseMoney(v)
  return Number.isFinite(n) ? n : null
}
