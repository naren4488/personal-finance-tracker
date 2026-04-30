import type { Commitment } from "@/lib/api/commitment-schemas"
import type { DashboardScheduledItem } from "@/lib/api/dashboard-home-schemas"
import type { Account } from "@/lib/api/account-schemas"
import {
  creditCardMinimumPaymentInr,
  creditCardOutstandingInr,
  isCreditCardAccount,
  nextDueDateFromDay,
  paymentDueDayNumber,
} from "@/lib/api/credit-card-map"
import { isLoanAccount, nextLoanEmiDueDate, resolveLoanEmiAmount } from "@/lib/api/loan-account-map"
import { parseSignedAmountString } from "@/lib/api/transaction-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"

/** YYYY-MM-DD */
export type IsoDateString = string

export type PayKind = "udhar_borrow" | "loan_emi" | "credit_card"

export type ReceiveKind = "udhar_lent" | "income"

/**
 * Normalized row for home money-flow lists (payables vs incoming).
 * `id` is stable for React keys (may be dashboard id, commitment id, synthetic key, or `tx:<id>`).
 */
export type MoneyFlowRow = {
  id: string
  title: string
  amount: number
  /** ISO date YYYY-MM-DD (due date for scheduled items, transaction date for income). */
  date: string
  type: "pay" | "receive"
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function formatYyyyMmDd(d: Date): IsoDateString {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function normalizeScheduledDate(dueDate: string): IsoDateString {
  const k = dueDate.trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(k)) return k
  return formatYyyyMmDd(startOfLocalDay(new Date()))
}

export function scheduledToPayRow(item: DashboardScheduledItem): MoneyFlowRow {
  const date = normalizeScheduledDate(item.dueDate)
  return {
    id: item.id,
    title: item.title.trim() || "Payment",
    amount: item.amount,
    date,
    type: "pay",
  }
}

export function scheduledToReceiveRow(item: DashboardScheduledItem): MoneyFlowRow {
  const date = normalizeScheduledDate(item.dueDate)
  return {
    id: item.id,
    title: item.title.trim() || "Incoming",
    amount: item.amount,
    date,
    type: "receive",
  }
}

/** Prefer income source / counterparty fields for display. */
export function incomeTxToMoneyFlowRow(tx: RecentTransaction): MoneyFlowRow | null {
  if (tx.type !== "income") return null
  const date = tx.date.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const n = Math.abs(parseSignedAmountString(tx.signedAmount))
  if (!Number.isFinite(n) || n <= 0) return null
  return {
    id: `tx:${tx.id}`,
    title: incomeDisplayTitle(tx),
    amount: n,
    date,
    type: "receive",
  }
}

function incomeDisplayTitle(tx: RecentTransaction): string {
  const rec = tx as unknown as Record<string, unknown>
  const src = typeof rec.incomeSource === "string" ? rec.incomeSource.trim() : ""
  if (src) {
    const human = src.replace(/_/g, " ")
    return human.charAt(0).toUpperCase() + human.slice(1)
  }
  if (tx.sourceName?.trim()) return tx.sourceName.trim()
  if (tx.subtitle?.trim()) return tx.subtitle.trim()
  const t = tx.title.trim()
  if (t && t !== "Transaction") return t
  return "Income"
}

export function sortMoneyFlowRows(rows: MoneyFlowRow[]): MoneyFlowRow[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return a.title.localeCompare(b.title)
  })
}

export function mergeMoneyFlowDedupe(rows: MoneyFlowRow[]): MoneyFlowRow[] {
  const seen = new Set<string>()
  const out: MoneyFlowRow[] = []
  for (const r of rows) {
    const key = `${r.date}|${r.type}|${r.title.toLowerCase()}|${Math.round(r.amount * 100)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(r)
  }
  return out
}

function loanRowTitle(a: Account): string {
  const name = (a.name ?? "").trim()
  const r = a as unknown as Record<string, unknown>
  const lender = typeof r.lenderName === "string" ? r.lenderName.trim() : ""
  if (name && lender) return `${name} · ${lender}`
  return name || lender || "Loan"
}

function cardRowTitle(a: Account): string {
  return (a.name ?? "Credit card").trim()
}

/** Inclusive calendar range: `horizonDays === 1` → today only. */
export function buildHorizonBounds(
  horizonDays: number,
  now = new Date()
): { start: Date; end: Date } {
  const start = startOfLocalDay(now)
  const end = new Date(start)
  end.setDate(end.getDate() + Math.max(1, Math.floor(horizonDays)) - 1)
  return { start, end }
}

/** Inclusive range [start, end] in local calendar days. */
export function isDateInHorizon(
  dateKey: IsoDateString | "—",
  start: Date,
  endInclusive: Date
): boolean {
  if (!dateKey || dateKey === "—") return false
  const k = dateKey.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return false
  const t = startOfLocalDay(new Date(k + "T12:00:00")).getTime()
  return t >= startOfLocalDay(start).getTime() && t <= startOfLocalDay(endInclusive).getTime()
}

export function filterMoneyFlowByHorizon(
  rows: MoneyFlowRow[],
  start: Date,
  endInclusive: Date
): MoneyFlowRow[] {
  return rows.filter((r) => isDateInHorizon(r.date, start, endInclusive))
}

function parseMoneyLoose(v: string | number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = Number(String(v).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}

export function outgoingBucket(item: DashboardScheduledItem): PayKind {
  return classifyOutgoingItem(item) ?? "udhar_borrow"
}

export function incomingBucket(item: DashboardScheduledItem): ReceiveKind {
  return classifyIncomingItem(item) ?? "udhar_lent"
}

/** What I owe others — udhar borrowed, loan EMI, credit card. */
export function classifyOutgoingItem(item: DashboardScheduledItem): PayKind | null {
  const kind = item.kind.toLowerCase()
  const title = item.title.toLowerCase()

  if (
    kind.includes("card_bill") ||
    kind.includes("credit_card") ||
    kind === "card" ||
    (kind.includes("credit") && !kind.includes("loan"))
  ) {
    return "credit_card"
  }
  if (kind.includes("loan") || kind.includes("emi") || /\bemi\b/.test(title)) {
    return "loan_emi"
  }
  if (
    kind.includes("person") ||
    kind.includes("udhar") ||
    kind.includes("borrow") ||
    kind.includes("money_taken") ||
    title.includes("udhar") ||
    (kind.includes("payable") && kind.includes("person"))
  ) {
    return "udhar_borrow"
  }
  if (kind.includes("payable") && !kind.includes("card") && !kind.includes("loan")) {
    return "udhar_borrow"
  }
  return null
}

/** Money coming to me — lent udhar recoveries vs salary / income. */
export function classifyIncomingItem(item: DashboardScheduledItem): ReceiveKind | null {
  const kind = item.kind.toLowerCase()
  const title = item.title.toLowerCase()

  if (
    kind.includes("salary") ||
    kind.includes("income") ||
    kind.includes("paycheck") ||
    title.includes("salary") ||
    title.includes("payroll") ||
    title.includes("freelance")
  ) {
    return "income"
  }
  if (
    kind.includes("person") ||
    kind.includes("udhar") ||
    kind.includes("lend") ||
    kind.includes("money_given") ||
    kind.includes("receivable") ||
    title.includes("udhar")
  ) {
    return "udhar_lent"
  }
  if (kind.includes("receivable") && !kind.includes("card")) {
    return "udhar_lent"
  }
  return null
}

export function commitmentToScheduled(c: Commitment): DashboardScheduledItem {
  const due =
    typeof c.dueDate === "string" && c.dueDate.trim() ? c.dueDate.trim().slice(0, 10) : "—"
  return {
    id: `commitment:${String(c.id)}`,
    title: String(c.title ?? "").trim() || "Commitment",
    amount: parseMoneyLoose(c.amount),
    dueDate: due,
    kind: String(c.kind ?? "").trim(),
    status: String(c.status ?? "").trim(),
  }
}

/** Pending commitments in range, merged with dashboard rows (dedupe by id). */
export function mergeScheduledItems(
  primary: DashboardScheduledItem[],
  extra: DashboardScheduledItem[]
): DashboardScheduledItem[] {
  const seen = new Set<string>()
  const out: DashboardScheduledItem[] = []
  for (const it of primary) {
    if (seen.has(it.id)) continue
    seen.add(it.id)
    out.push(it)
  }
  for (const it of extra) {
    if (seen.has(it.id)) continue
    seen.add(it.id)
    out.push(it)
  }
  return out
}

export function filterByHorizon(
  items: DashboardScheduledItem[],
  start: Date,
  endInclusive: Date
): DashboardScheduledItem[] {
  return items.filter((it) => isDateInHorizon(it.dueDate, start, endInclusive))
}

/** Loan EMI due in horizon when dashboard did not list this loan (by name match on same due date). */
export function supplementLoanEmiItems(
  accounts: Account[],
  horizonEnd: Date,
  existing: DashboardScheduledItem[]
): DashboardScheduledItem[] {
  const now = startOfLocalDay(new Date())
  const end = startOfLocalDay(horizonEnd)
  const out: DashboardScheduledItem[] = []

  for (const a of accounts) {
    if (!isLoanAccount(a)) continue
    const nextRaw = nextLoanEmiDueDate(a)
    if (nextRaw == null) continue
    const next = startOfLocalDay(nextRaw)
    if (next.getTime() < now.getTime() || next.getTime() > end.getTime()) continue

    const dueKey = formatYyyyMmDd(next)
    const emi = resolveLoanEmiAmount(a) ?? 0
    const title = loanRowTitle(a)

    const dup = existing.some(
      (e) =>
        classifyOutgoingItem(e) === "loan_emi" &&
        e.dueDate.slice(0, 10) === dueKey &&
        e.title.trim().toLowerCase() === title.toLowerCase()
    )
    if (dup) continue

    out.push({
      id: `loan-supplement:${a.id}:${dueKey}`,
      title,
      amount: emi,
      dueDate: dueKey,
      kind: "loan_emi",
      status: "scheduled",
    })
  }
  return out
}

/** Next card payment due in horizon (minimum due or outstanding fallback). */
export function supplementCreditCardItems(
  accounts: Account[],
  horizonEnd: Date,
  existing: DashboardScheduledItem[]
): DashboardScheduledItem[] {
  const now = startOfLocalDay(new Date())
  const end = startOfLocalDay(horizonEnd)
  const out: DashboardScheduledItem[] = []

  for (const a of accounts) {
    if (!isCreditCardAccount(a)) continue
    const dayNum = paymentDueDayNumber(a)
    if (dayNum == null) continue
    const next = startOfLocalDay(nextDueDateFromDay(dayNum))
    if (next.getTime() < now.getTime() || next.getTime() > end.getTime()) continue

    const dueKey = formatYyyyMmDd(next)
    const minDue = creditCardMinimumPaymentInr(a)
    const amount = minDue ?? creditCardOutstandingInr(a)
    if (!(amount > 0)) continue

    const title = cardRowTitle(a)

    const dup = existing.some(
      (e) =>
        classifyOutgoingItem(e) === "credit_card" &&
        e.dueDate.slice(0, 10) === dueKey &&
        e.title.trim().toLowerCase() === title.toLowerCase()
    )
    if (dup) continue

    out.push({
      id: `card-supplement:${a.id}:${dueKey}`,
      title,
      amount,
      dueDate: dueKey,
      kind: "credit_card",
      status: "scheduled",
    })
  }
  return out
}
