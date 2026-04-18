/**
 * GET /api/v1/dashboard — home snapshot (summary, payables, accounts, recent tx).
 */
import {
  coerceUnknownToRecentTransaction,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"

function parseMoney(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(String(v).replace(/,/g, "").replace(/\s/g, "").trim())
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function parseIntLoose(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.floor(v)
  if (typeof v === "string") {
    const n = parseInt(v.replace(/,/g, "").trim(), 10)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

export type DashboardScheduledItem = {
  id: string
  title: string
  amount: number
  dueDate: string
  kind: string
  status: string
}

export type DashboardAccountPreview = {
  id: string
  name: string
  kind: string
  currentBalance: number
  creditLimit: number
  currentOutstanding: number
  status: string
  /** Dashboard may expose spendable headroom directly (camelCase or parsed from snake_case). */
  availableLimit?: number
  remainingLimit?: number
  /** Loan remaining / outstanding from dashboard payload when provided. */
  remainingBalance?: number
  outstandingAmount?: number
  remainingAmount?: number
  totalLoanAmount?: number
}

export type DashboardHomeView = {
  summary: {
    totalBalance: number
    income: number
    expenses: number
    cardDues: number
    personDues: number
  }
  toBePaid: { days: number; total: number; items: DashboardScheduledItem[] }
  incomingMoney: { days: number; total: number; items: DashboardScheduledItem[] }
  coverage: {
    upcomingPayments: number
    expectedIncoming: number
    availableBalance: number
    surplus: number
  }
  stats: {
    toReceive: number
    cardOutstanding: number
    activeLoans: number
  }
  accounts: DashboardAccountPreview[]
  recentTransactions: RecentTransaction[]
}

function parseScheduledItem(raw: unknown): DashboardScheduledItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = o.id != null ? String(o.id).trim() : ""
  const title = typeof o.title === "string" ? o.title.trim() : ""
  const dueDate = typeof o.dueDate === "string" ? o.dueDate.trim().slice(0, 10) : ""
  if (!id || !title) return null
  return {
    id,
    title,
    amount: parseMoney(o.amount),
    dueDate: dueDate || "—",
    kind: typeof o.kind === "string" ? o.kind : "",
    status: typeof o.status === "string" ? o.status : "",
  }
}

function parseScheduledBlock(
  raw: unknown,
  fallbackDays: number
): { days: number; total: number; items: DashboardScheduledItem[] } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { days: fallbackDays, total: 0, items: [] }
  }
  const o = raw as Record<string, unknown>
  const days = parseIntLoose(o.days, fallbackDays)
  const total = parseMoney(o.total)
  const itemsRaw = o.items
  const items: DashboardScheduledItem[] = []
  if (Array.isArray(itemsRaw)) {
    for (const row of itemsRaw) {
      const it = parseScheduledItem(row)
      if (it) items.push(it)
    }
  }
  return { days, total, items }
}

function parseOptionalMoneyField(
  o: Record<string, unknown>,
  keys: readonly string[]
): number | undefined {
  for (const k of keys) {
    const v = o[k]
    if (v === undefined || v === null) continue
    const n = parseMoney(v)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function parseAccountPreview(raw: unknown): DashboardAccountPreview | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const id = o.id != null ? String(o.id).trim() : ""
  const name = typeof o.name === "string" ? o.name.trim() : ""
  if (!id || !name) return null
  const availableLimit = parseOptionalMoneyField(o, ["availableLimit", "available_limit"])
  const remainingLimit = parseOptionalMoneyField(o, ["remainingLimit", "remaining_limit"])
  const remainingBalance = parseOptionalMoneyField(o, ["remainingBalance", "remaining_balance"])
  const outstandingAmount = parseOptionalMoneyField(o, ["outstandingAmount", "outstanding_amount"])
  const remainingAmount = parseOptionalMoneyField(o, ["remainingAmount", "remaining_amount"])
  const totalLoanAmount = parseOptionalMoneyField(o, ["totalLoanAmount", "total_loan_amount"])

  return {
    id,
    name,
    kind: typeof o.kind === "string" ? o.kind.trim().toLowerCase() : "other",
    currentBalance: parseMoney(o.currentBalance),
    creditLimit: parseMoney(o.creditLimit),
    currentOutstanding: parseMoney(o.currentOutstanding),
    status: typeof o.status === "string" ? o.status.trim() : "",
    ...(availableLimit !== undefined ? { availableLimit } : {}),
    ...(remainingLimit !== undefined ? { remainingLimit } : {}),
    ...(remainingBalance !== undefined ? { remainingBalance } : {}),
    ...(outstandingAmount !== undefined ? { outstandingAmount } : {}),
    ...(remainingAmount !== undefined ? { remainingAmount } : {}),
    ...(totalLoanAmount !== undefined ? { totalLoanAmount } : {}),
  }
}

function extractDashboardPayload(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  const root = raw as Record<string, unknown>

  const data = root.data
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    const d = data as Record<string, unknown>
    const dash = d.dashboard
    if (dash !== null && typeof dash === "object" && !Array.isArray(dash)) {
      return dash as Record<string, unknown>
    }
    if (d.summary != null || d.accounts != null) {
      return d
    }
  }

  if (root.summary != null || root.accounts != null) {
    return root
  }

  return null
}

export function parseDashboardHomeResponse(
  raw: unknown,
  options?: { horizonDays?: number }
): { ok: true; view: DashboardHomeView } | { ok: false; error: string } {
  const horizon = options?.horizonDays ?? 7
  const payload = extractDashboardPayload(raw)
  if (!payload) {
    return { ok: false, error: "Invalid dashboard response." }
  }

  const summaryRaw = payload.summary
  const summaryObj =
    summaryRaw !== null && typeof summaryRaw === "object" && !Array.isArray(summaryRaw)
      ? (summaryRaw as Record<string, unknown>)
      : {}

  const summary = {
    totalBalance: parseMoney(summaryObj.totalBalance),
    income: parseMoney(summaryObj.income),
    expenses: parseMoney(summaryObj.expenses),
    cardDues: parseMoney(summaryObj.cardDues),
    personDues: parseMoney(summaryObj.personDues),
  }

  const toBePaid = parseScheduledBlock(payload.toBePaid, horizon)
  const incomingMoney = parseScheduledBlock(payload.incomingMoney, horizon)

  const coverageRaw = payload.coverage
  const cov =
    coverageRaw !== null && typeof coverageRaw === "object" && !Array.isArray(coverageRaw)
      ? (coverageRaw as Record<string, unknown>)
      : {}
  const coverage = {
    upcomingPayments: parseMoney(cov.upcomingPayments),
    expectedIncoming: parseMoney(cov.expectedIncoming),
    availableBalance: parseMoney(cov.availableBalance),
    surplus: parseMoney(cov.surplus),
  }

  const statsRaw = payload.stats
  const st =
    statsRaw !== null && typeof statsRaw === "object" && !Array.isArray(statsRaw)
      ? (statsRaw as Record<string, unknown>)
      : {}
  const stats = {
    toReceive: parseMoney(st.toReceive),
    cardOutstanding: parseMoney(st.cardOutstanding),
    activeLoans: parseIntLoose(st.activeLoans, 0),
  }

  const accounts: DashboardAccountPreview[] = []
  const accArr = payload.accounts
  if (Array.isArray(accArr)) {
    for (const row of accArr) {
      const a = parseAccountPreview(row)
      if (a) accounts.push(a)
    }
  }

  const recentTransactions: RecentTransaction[] = []
  const rtx = payload.recentTransactions
  if (Array.isArray(rtx)) {
    for (const row of rtx) {
      const tx = coerceUnknownToRecentTransaction(row)
      if (tx) recentTransactions.push(tx)
    }
  }

  return {
    ok: true,
    view: {
      summary,
      toBePaid,
      incomingMoney,
      coverage,
      stats,
      accounts,
      recentTransactions,
    },
  }
}
