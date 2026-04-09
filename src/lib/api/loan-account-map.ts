import type { Account } from "@/lib/api/account-schemas"
import { accountBalanceInrFromApi } from "@/lib/api/account-schemas"
import {
  formatPaymentDueFromAccount,
  interestRatePercentFromAccount,
  nextDueDateFromDay,
} from "@/lib/api/credit-card-map"
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

function paidInstallments(a: Account): number {
  const r = asRec(a)
  const p = r.paidInstallments
  if (p === undefined || p === null) return 0
  const n = typeof p === "number" ? p : Number(String(p).replace(/\D/g, ""))
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

function tenureMonths(a: Account): number {
  const r = asRec(a)
  const t = r.tenureMonths
  if (t === undefined || t === null) return 0
  const n = typeof t === "number" ? t : Number(String(t).replace(/\D/g, ""))
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

function remainingInstallments(a: Account): number {
  const r = asRec(a)
  const rem = r.remainingInstallments
  if (rem !== undefined && rem !== null) {
    const n = typeof rem === "number" ? rem : Number(String(rem).replace(/\D/g, ""))
    if (Number.isFinite(n)) return Math.max(0, Math.trunc(n))
  }
  const paid = paidInstallments(a)
  const ten = tenureMonths(a)
  return ten > 0 ? Math.max(0, ten - paid) : 0
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

function loanEmiDueDateLabel(a: Account): string | null {
  const day = loanEmiDueDayNumber(a)
  if (day === null) return null
  return formatDate(nextDueDateFromDay(day))
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

/** Total principal repaid: API field or estimated as paid EMIs × EMI when possible. */
export function loanTotalPaidInr(a: Account): number | null {
  const r = asRec(a)
  const keys = [
    "totalPaid",
    "totalAmountPaid",
    "amountPaid",
    "principalRepaid",
    "totalPaidAmount",
    "totalPaidInr",
  ] as const
  for (const k of keys) {
    const v = r[k]
    if (v === undefined || v === null) continue
    const n = parseMoney(v)
    if (Number.isFinite(n) && n >= 0) return n
  }
  const paid = paidInstallments(a)
  if (paid === 0) return 0
  const emi = resolveLoanEmiAmount(a)
  if (emi != null && paid > 0) return Math.round(emi * paid)
  return null
}

/** Repayment progress 0–100 from paid vs tenure EMIs. */
export function loanRepaymentProgressPercent(a: Account): number | null {
  const paid = paidInstallments(a)
  const ten = tenureMonths(a)
  if (ten <= 0) return null
  return Math.min(100, Math.max(0, Math.round((100 * paid) / ten)))
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
  const paid = paidInstallments(a)
  const tenure = tenureMonths(a)
  const remaining = remainingInstallments(a)

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
  if (tenure > 0) metaParts.push(`${paid}/${tenure} EMIs`)
  metaParts.push(statusLabel)
  if (emiDueDateLabel) metaParts.push(`Due: ${emiDueDateLabel}`)

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
    statusLabel,
    isActive,
    emiAmount: resolveLoanEmiAmount(a),
    emiDueDateLabel,
    accountsRowMeta: metaParts.join(" · "),
  }
}
