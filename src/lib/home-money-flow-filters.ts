import type { DashboardScheduledItem } from "@/lib/api/dashboard-home-schemas"
import { startOfLocalDay } from "@/lib/date/local-date"
import {
  buildHorizonBounds,
  classifyIncomingItem,
  classifyOutgoingItem,
  isDateInHorizon,
  scheduledToPayRow,
  scheduledToReceiveRow,
  sortMoneyFlowRows,
  type MoneyFlowRow,
} from "@/lib/home-money-overview"

/** Statuses that mean the obligation is finished — hide from home payables/receivables. */
const TERMINAL_SCHEDULED_STATUSES = new Set([
  "settled",
  "cancelled",
  "canceled",
  "completed",
  "paid",
  "received",
  "done",
  "closed",
])

const PENDING_SCHEDULED_STATUSES = new Set(["pending", "active", "open"])

function parseDueDateMs(dueDate: string): number | null {
  const k = dueDate.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return null
  return startOfLocalDay(new Date(k + "T12:00:00")).getTime()
}

/** True when the dashboard row is still an open obligation (not paid/settled/etc.). */
export function isPendingDashboardScheduledItem(item: DashboardScheduledItem): boolean {
  const s = item.status.trim().toLowerCase()
  if (!s) return true
  if (TERMINAL_SCHEDULED_STATUSES.has(s)) return false
  if (PENDING_SCHEDULED_STATUSES.has(s)) return true
  return !TERMINAL_SCHEDULED_STATUSES.has(s)
}

/**
 * Due within [today, today + horizonDays - 1], or overdue but still pending.
 */
export function isScheduledDueVisibleInHomeWindow(
  item: DashboardScheduledItem,
  horizonDays: number,
  now = new Date()
): boolean {
  if (!isPendingDashboardScheduledItem(item)) return false

  const { start, end } = buildHorizonBounds(horizonDays, now)
  const due = item.dueDate.trim().slice(0, 10)
  if (isDateInHorizon(due, start, end)) return true

  const dueMs = parseDueDateMs(due)
  if (dueMs == null) return false
  const startMs = startOfLocalDay(start).getTime()
  return dueMs < startMs
}

export function filterPendingScheduledForHomeWindow(
  items: DashboardScheduledItem[],
  horizonDays: number,
  now = new Date()
): DashboardScheduledItem[] {
  return items.filter((it) => isScheduledDueVisibleInHomeWindow(it, horizonDays, now))
}

export type HomeOutgoingGroups = {
  udhar: MoneyFlowRow[]
  loan: MoneyFlowRow[]
  card: MoneyFlowRow[]
}

export type HomeIncomingGroups = {
  udhar: MoneyFlowRow[]
  income: MoneyFlowRow[]
}

/** Group dashboard `toBePaid.items` for display only — totals come from API `toBePaid.total`. */
export function buildHomeOutgoingGroups(items: DashboardScheduledItem[]): HomeOutgoingGroups {
  const udhar: MoneyFlowRow[] = []
  const loan: MoneyFlowRow[] = []
  const card: MoneyFlowRow[] = []

  for (const item of items) {
    const row = scheduledToPayRow(item)
    const bucket = classifyOutgoingItem(item)
    if (bucket === "credit_card") card.push(row)
    else if (bucket === "loan_emi") loan.push(row)
    else udhar.push(row)
  }

  return {
    udhar: sortMoneyFlowRows(udhar),
    loan: sortMoneyFlowRows(loan),
    card: sortMoneyFlowRows(card),
  }
}

/** Group dashboard `incomingMoney.items` for display only — totals come from API `incomingMoney.total`. */
export function buildHomeIncomingGroups(items: DashboardScheduledItem[]): HomeIncomingGroups {
  const udhar: MoneyFlowRow[] = []
  const income: MoneyFlowRow[] = []

  for (const item of items) {
    const row = scheduledToReceiveRow(item)
    const bucket = classifyIncomingItem(item)
    if (bucket === "income") income.push(row)
    else udhar.push(row)
  }

  return {
    udhar: sortMoneyFlowRows(udhar),
    income: sortMoneyFlowRows(income),
  }
}
