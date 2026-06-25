import type { Account } from "@/lib/api/account-schemas"
import { accountBalanceInrFromApi } from "@/lib/api/account-schemas"
import {
  formatPaymentDueFromAccount,
  interestRatePercentFromAccount,
  nextDueDateFromDay,
} from "@/lib/api/credit-card-map"
import { formatCurrency, formatDate } from "@/lib/format"

function parseMoney(v: unknown): number {
  if (v === undefined || v === null) return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const n = Number(String(v).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}

function asRec(a: Account): Record<string, unknown> {
  return a as unknown as Record<string, unknown>
}

export function isLoanAccount(a: Account): boolean {
  const k = `${a.kind ?? a.type ?? ""}`.toLowerCase().replace(/\s+/g, "_")
  if (k === "loan") return true
  const r = asRec(a)
  return (
    typeof r.lenderName === "string" &&
    r.lenderName.trim().length > 0 &&
    (r.principalAmount != null || r.tenureMonths != null)
  )
}

/** Prefer explicit loan outstanding fields, then balance. */
export function loanOutstandingInr(a: Account): number {
  const r = asRec(a)
  const o = r.currentOutstanding ?? r.currentBalance ?? r.outstanding ?? r.outstandingBalance
  if (o !== undefined && o !== null) return parseMoney(o)
  const cop = r.currentOutstandingPrincipal
  if (cop !== undefined && cop !== null) return parseMoney(cop)
  return accountBalanceInrFromApi(a)
}

export function loanPrincipalInr(a: Account): number {
  const r = asRec(a)
  const p = r.principalAmount ?? r.principal
  if (p !== undefined && p !== null) return parseMoney(p)
  return 0
}

function paidInstallmentsFromAccount(a: Account): number {
  const r = asRec(a)
  const p = r.paidInstallments
  if (p === undefined || p === null) return 0
  const n = typeof p === "number" ? p : Number(String(p).replace(/\D/g, ""))
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

/** Paid EMI count from API (`paidInstallments`). */
export function loanPaidInstallments(a: Account): number {
  return paidInstallmentsFromAccount(a)
}

function tenureMonths(a: Account): number {
  const r = asRec(a)
  const t = r.tenureMonths
  if (t === undefined || t === null) return 0
  const n = typeof t === "number" ? t : Number(String(t).replace(/\D/g, ""))
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

function remainingInstallmentsFromAccount(a: Account): number {
  const r = asRec(a)
  const rem = r.remainingInstallments
  if (rem !== undefined && rem !== null) {
    const n = typeof rem === "number" ? rem : Number(String(rem).replace(/\D/g, ""))
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n))
  }
  const paid = paidInstallmentsFromAccount(a)
  const ten = tenureMonths(a)
  return ten > 0 ? Math.max(0, ten - paid) : 0
}

/** Remaining EMI count from API (`remainingInstallments` or tenure − paid). */
export function loanRemainingInstallments(a: Account): number {
  return remainingInstallmentsFromAccount(a)
}

/** EMI calendar day 1–31 from `emiDueDay`. */
export function loanEmiDueDayNumber(a: Account): number | null {
  const r = asRec(a)
  const d = r.emiDueDay
  if (d === undefined || d === null) return null
  const n = typeof d === "number" ? d : Number(String(d).replace(/\D/g, ""))
  if (!Number.isFinite(n)) return null
  const day = Math.trunc(n)
  if (day < 1 || day > 31) return null
  return day
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function parseYyyyMmDdLocal(iso: string): Date | null {
  const s = iso.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const day = Number(s.slice(8, 10))
  const dt = new Date(y, m - 1, day)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== day) return null
  return startOfLocalDay(dt)
}

function addCalendarDays(d: Date, n: number): Date {
  const x = new Date(d.getTime())
  x.setDate(x.getDate() + n)
  return startOfLocalDay(x)
}

/**
 * True when the loan uses a rolling 30-day schedule from `startDate` (not same calendar day each month).
 */
export function loanDueDateCycleIsRolling(a: Account): boolean {
  const r = asRec(a)
  const raw =
    typeof r.dueDateCycle === "string"
      ? r.dueDateCycle.trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_")
      : ""
  if (!raw) return false
  if (raw.includes("fixed") && (raw.includes("month") || raw.includes("monthly"))) return false
  return raw === "rolling" || raw.startsWith("rolling_")
}

/**
 * Next EMI due date in local time: fixed monthly uses the same calendar day each month; rolling uses every 30 days from `startDate`.
 */
export function nextLoanEmiDueDate(a: Account, now = new Date()): Date | null {
  if (loanDueDateCycleIsRolling(a)) {
    const r = asRec(a)
    const sd = r.startDate
    const iso = typeof sd === "string" ? sd : ""
    const start = parseYyyyMmDdLocal(iso)
    if (start == null) return null
    const today = startOfLocalDay(now)
    let cursor = start
    while (cursor.getTime() < today.getTime()) {
      cursor = addCalendarDays(cursor, 30)
    }
    return cursor
  }
  const day = loanEmiDueDayNumber(a)
  if (day === null) return null
  return nextDueDateFromDay(day, now)
}

function loanEmiDueDateLabel(a: Account): string | null {
  const next = nextLoanEmiDueDate(a)
  if (next == null) return null
  return formatDate(next)
}

/** Fallback when only `paymentDueDay` exists on hybrid payloads. */
function loanOrPaymentDueDateLabel(a: Account): string | null {
  const emi = loanEmiDueDateLabel(a)
  if (emi) return emi
  return formatPaymentDueFromAccount(a)
}

export function formatLoanTypeDisplay(loanType: unknown): string {
  const s = typeof loanType === "string" ? loanType.trim() : ""
  if (!s) return "Loan"
  const human = s.replace(/_/g, " ")
  return human.charAt(0).toUpperCase() + human.slice(1)
}

/** Recognize common API shapes for monthly EMI (flat). */
function parseOptionalEmiAmount(a: Account): number | null {
  const r = asRec(a)
  const keys = [
    "monthlyEmiAmount",
    "monthly_emi_amount",
    "emiAmount",
    "monthlyEmi",
    "emi",
    "installmentAmount",
    "equatedMonthlyInstallment",
    "monthlyInstallment",
    "scheduledEmi",
    "scheduledPayment",
    "nextEmiAmount",
    "emiValue",
    "emi_amount",
    "monthly_emi",
  ] as const
  for (const k of keys) {
    const v = r[k]
    if (v === undefined || v === null) continue
    const n = parseMoney(v)
    if (n > 0) return n
  }
  return null
}

/** Principal to use for EMI: original loan amount, else outstanding principal, else total outstanding. */
function principalForEmiCalculation(a: Account): number {
  const p = loanPrincipalInr(a)
  if (p > 0) return p
  const r = asRec(a)
  const cop = r.currentOutstandingPrincipal
  if (cop !== undefined && cop !== null) {
    const n = parseMoney(cop)
    if (n > 0) return n
  }
  const out = loanOutstandingInr(a)
  return out > 0 ? out : 0
}

/**
 * Reducing-balance EMI (monthly), annual rate as % p.a.
 * If rate is missing, falls back to principal / tenure (interest-free).
 */
function deriveEmiInr(
  principal: number,
  annualRatePercent: number | null | undefined,
  months: number
): number | null {
  if (!(principal > 0) || !(months > 0)) return null
  const n = Math.trunc(months)
  const rate = annualRatePercent
  if (rate == null || !Number.isFinite(rate) || rate < 0) {
    return Math.round(principal / n)
  }
  if (rate === 0) {
    return Math.round(principal / n)
  }
  const r = rate / 12 / 100
  const pow = (1 + r) ** n
  const emi = (principal * r * pow) / (pow - 1)
  if (!Number.isFinite(emi) || emi <= 0) return null
  return Math.round(emi * 100) / 100
}

/** Prefer API EMI fields; otherwise derive from principal, rate, tenure. */
export function resolveLoanEmiAmount(a: Account): number | null {
  const direct = parseOptionalEmiAmount(a)
  if (direct != null) return direct

  const p = principalForEmiCalculation(a)
  const months = tenureMonths(a)
  const rate = interestRatePercentFromAccount(a)
  return deriveEmiInr(p, rate, months)
}

function parseOptionalMoneyField(a: Account, keys: readonly string[]): number | null {
  const r = asRec(a)
  for (const k of keys) {
    const v = r[k]
    if (v === undefined || v === null) continue
    const n = parseMoney(v)
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100
  }
  return null
}

/** Interest slice of next EMI when API exposes it. */
export function loanNextEmiInterestInr(a: Account): number | null {
  return parseOptionalMoneyField(a, [
    "monthlyInterestAmount",
    "monthly_interest_amount",
    "nextEmiInterest",
    "emiInterest",
    "interestComponent",
    "nextPaymentInterest",
    "next_emi_interest",
    "nextInstallmentInterest",
  ])
}

/**
 * Principal slice of next EMI when API exposes it; else full EMI from
 * `resolveLoanEmiAmount` minus interest when both exist; else full EMI as principal.
 */
export function loanNextEmiPrincipalInr(a: Account): number | null {
  const direct = parseOptionalMoneyField(a, [
    "monthlyPrincipalAmount",
    "monthly_principal_amount",
    "nextEmiPrincipal",
    "emiPrincipal",
    "principalComponent",
    "nextPaymentPrincipal",
    "next_emi_principal",
    "nextInstallmentPrincipal",
  ])
  if (direct != null) return direct

  const emi = resolveLoanEmiAmount(a)
  if (emi == null || !(emi > 0)) return null
  const interestPart = loanNextEmiInterestInr(a)
  if (interestPart != null && interestPart > 0 && interestPart < emi) {
    return Math.round((emi - interestPart) * 100) / 100
  }
  return emi
}

const round2Inr = (n: number) => Math.round(n * 100) / 100

/**
 * Principal/interest split for POST /transactions with `destinationType: loan_payment`.
 * Prepayment: all principal. EMI-style: scale next-installment principal/interest ratio to `totalInr`.
 */
export function loanPaymentComponentsForTotalInr(
  loan: Account,
  totalInr: number,
  mode: "schedule_based" | "all_principal"
): { principalInr: number; interestInr: number } {
  if (!Number.isFinite(totalInr) || totalInr <= 0) {
    return { principalInr: 0, interestInr: 0 }
  }
  const t = round2Inr(totalInr)
  if (mode === "all_principal") {
    return { principalInr: t, interestInr: 0 }
  }
  const p0 = loanNextEmiPrincipalInr(loan) ?? 0
  const i0 = loanNextEmiInterestInr(loan) ?? 0
  const base = round2Inr(p0 + i0)
  if (base > 0) {
    const principalInr = round2Inr((t * p0) / base)
    const interestInr = round2Inr(t - principalInr)
    return { principalInr, interestInr }
  }
  return { principalInr: t, interestInr: 0 }
}

function loanIsActive(a: Account): boolean {
  const r = asRec(a)
  if (r.isActive === false) return false
  const st = typeof r.status === "string" ? r.status.trim().toLowerCase() : ""
  if (st === "closed" || st === "inactive" || st === "settled") return false
  return true
}

export type LoanViewModel = {
  id: string
  name: string
  lenderName: string
  loanTypeDisplay: string
  interestRateLabel: string
  subtitleLine: string
  outstanding: number
  principal: number
  outstandingVsPrincipalPercent: number
  paid: number
  tenure: number
  remainingTenure: number
  emiProgressLabel: string | null
  totalPaidInr: number | null
  monthlyInterestInr: number | null
  monthlyPrincipalInr: number | null
  statusLabel: string
  isActive: boolean
  emiAmount: number | null
  emiDueDateLabel: string | null
  accountsRowMeta: string
}

/** Last 4 digits of loan account number for display (e.g. "8769"). */
export function loanAccountDisplayTail(a: Account): string | null {
  const r = asRec(a)
  const raw = r.loanAccountNumber ?? r.loanAccountNo ?? r.accountNumber ?? r.loan_account_number
  if (typeof raw !== "string" || !raw.trim()) return null
  const digits = raw.replace(/\D/g, "")
  if (digits.length >= 4) return digits.slice(-4)
  return raw.trim().length > 0 ? raw.trim() : null
}

/** Human label for EMI due cycle from API. */
export function loanDueDateCycleLabel(a: Account): string | null {
  const r = asRec(a)
  const c = r.dueDateCycle
  if (typeof c !== "string" || !c.trim()) return null
  const s = c.trim().toLowerCase().replace(/-/g, "_")
  if (s.includes("fixed") && s.includes("month")) return "Fixed Date"
  if (s === "rolling" || s.includes("rolling")) return "Rolling"
  return c
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/** Subtitle under loan name: "Personal Loan • Fixed Date". */
export function loanHeaderSubtitle(a: Account): string {
  const r = asRec(a)
  const typePart = formatLoanTypeDisplay(r.loanType)
  const cycle = loanDueDateCycleLabel(a)
  const parts = [typePart !== "Loan" ? typePart : "", cycle ?? ""].filter(Boolean)
  return parts.join(" • ")
}

/** Total amount repaid — prefer API money fields; fallback to paidInstallments × EMI only when no total. */
export function loanTotalPaidInr(a: Account): number | null {
  const r = asRec(a)
  const keys = [
    "totalPaid",
    "totalAmountPaid",
    "amountPaid",
    "principalRepaid",
    "totalPaidAmount",
    "totalPaidInr",
    "totalPrincipalRepaid",
  ] as const
  for (const k of keys) {
    const v = r[k]
    if (v === undefined || v === null) continue
    const n = parseMoney(v)
    if (Number.isFinite(n) && n >= 0) return n
  }
  const paid = paidInstallmentsFromAccount(a)
  if (paid === 0) return 0
  const emi = resolveLoanEmiAmount(a)
  if (emi != null && paid > 0) return Math.round(emi * paid * 100) / 100
  return null
}

/** Human label for EMI repayment progress from backend counts. */
export function loanEmiProgressLabel(a: Account): string | null {
  const paid = paidInstallmentsFromAccount(a)
  const tenure = tenureMonths(a)
  if (tenure <= 0 && paid <= 0) return null
  if (tenure > 0) return `${paid} of ${tenure} EMIs paid`
  if (paid > 0) return `${paid} EMIs paid`
  return null
}

/** Repayment progress 0–100 from API `paidInstallments` / `tenureMonths`. */
export function loanRepaymentProgressPercent(a: Account): number | null {
  const paid = paidInstallmentsFromAccount(a)
  const ten = tenureMonths(a)
  if (ten <= 0) return null
  return Math.min(100, Math.max(0, Math.round((100 * paid) / ten)))
}

/** Compact label for list cards: paid count from API (`paidInstallments`). */
export function loanPaidEmiListLabel(paid: number, remaining?: number): string {
  const n = Math.max(0, Math.trunc(paid))
  const base = n === 1 ? "1 EMI paid" : `${n} EMIs paid`
  if (remaining != null && remaining > 0) {
    const left = Math.trunc(remaining)
    return `${base} · ${left} left`
  }
  return base
}

export function mapAccountToLoanView(a: Account): LoanViewModel {
  const r = asRec(a)
  const lender =
    typeof r.lenderName === "string" && r.lenderName.trim()
      ? r.lenderName.trim()
      : typeof a.bankName === "string" && a.bankName.trim()
        ? a.bankName.trim()
        : ""

  const principal = loanPrincipalInr(a)
  const outstanding = loanOutstandingInr(a)
  const paid = paidInstallmentsFromAccount(a)
  const tenure = tenureMonths(a)
  const remaining = remainingInstallmentsFromAccount(a)
  const emiAmount = resolveLoanEmiAmount(a)
  const totalPaidInr = loanTotalPaidInr(a)
  const monthlyInterestInr = loanNextEmiInterestInr(a)
  const monthlyPrincipalInr = loanNextEmiPrincipalInr(a)
  const emiProgressLabel = loanEmiProgressLabel(a)

  const pct =
    principal > 0
      ? Math.min(100, Math.max(0, Math.round((100 * outstanding) / principal)))
      : outstanding > 0
        ? 100
        : 0

  const rate = interestRatePercentFromAccount(a)
  const interestRateLabel =
    rate != null && rate >= 0
      ? `${rate % 1 === 0 ? String(Math.round(rate)) : rate.toFixed(1)}%`
      : ""

  const loanTypeDisplay = formatLoanTypeDisplay(r.loanType)
  const subParts = [loanTypeDisplay, lender, interestRateLabel].filter(Boolean)
  const subtitleLine = subParts.join(" · ")

  const isActive = loanIsActive(a)
  const statusLabel = isActive ? "active" : "closed"

  const emiDueDateLabel = loanOrPaymentDueDateLabel(a)

  const metaParts: string[] = []
  if (paid > 0 || tenure > 0) {
    metaParts.push(loanPaidEmiListLabel(paid, tenure > 0 ? remaining : undefined))
  }
  metaParts.push(statusLabel)
  if (emiDueDateLabel) metaParts.push(`Due: ${emiDueDateLabel}`)
  if (emiAmount != null) metaParts.push(`${formatCurrency(emiAmount)}/mo`)

  return {
    id: a.id,
    name: a.name,
    lenderName: lender,
    loanTypeDisplay,
    interestRateLabel,
    subtitleLine,
    outstanding,
    principal,
    outstandingVsPrincipalPercent: pct,
    paid,
    tenure,
    remainingTenure: remaining,
    emiProgressLabel,
    totalPaidInr,
    monthlyInterestInr,
    monthlyPrincipalInr,
    statusLabel,
    isActive,
    emiAmount,
    emiDueDateLabel,
    accountsRowMeta: metaParts.join(" · "),
  }
}
