/**
 * GET /api/v1/dashboard/analytics — relaxed parsing + UI-ready view model.
 * Supports flat `data` or nested `summary` / `stats` objects and common field aliases.
 *
 * All monetary aggregates and counts should be computed on the backend (`include_all=true`).
 * Optional `monthlyTrendRows` fields: `loanPayment`, `creditCardBillPayment`, `creditCardSpend`
 * (per month) for grouped charts when the API provides them.
 */

const CATEGORY_CHART_COLORS = [
  "#1e3a8a",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#64748b",
]

const PAYMENT_BAR_CLASSES = [
  "bg-blue-800",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-slate-400",
  "bg-violet-600",
  "bg-rose-500",
]

const TYPE_DOT_CLASSES = [
  "bg-blue-800",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-red-500",
  "bg-blue-400",
  "bg-purple-500",
  "bg-cyan-600",
  "bg-orange-500",
]

function toNum(v: unknown): number {
  if (v === undefined || v === null) return 0
  if (typeof v === "number") return Number.isFinite(v) ? v : 0
  const n = Number(String(v).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n : 0
}

function pickNum(obj: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    if (k in obj) return toNum(obj[k])
  }
  return 0
}

function pickStr(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k]
    if (v === undefined || v === null) continue
    const s = String(v).trim()
    if (s) return s
  }
  return ""
}

/** Display savings rate: API may send ratio (0–1) or percent (0–100). */
function normalizeSavingsRateDisplay(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  if (raw > 0 && raw <= 1) return Math.round(raw * 1000) / 10
  return Math.round(raw * 10) / 10
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/** Prefer backend keys in camelCase or snake_case. */
function pluckArray(payload: Record<string, unknown>, ...keys: string[]): unknown[] {
  for (const k of keys) {
    const v = payload[k]
    if (Array.isArray(v)) return v
  }
  return []
}

/**
 * Unwrap common API envelopes: `data`, `data.analytics`, `data.dashboard`, `result`, etc.
 */
function extractPayload(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw)
  if (!root) return null
  if (root.success === false) return null

  const candidates: Record<string, unknown>[] = []
  const dataObj = asRecord(root.data)
  if (dataObj) {
    candidates.push(dataObj)
    for (const k of ["analytics", "dashboard", "report", "payload"]) {
      const inner = asRecord(dataObj[k])
      if (inner) candidates.push(inner)
    }
  }
  for (const k of ["analytics", "dashboard", "result", "payload", "report"]) {
    const inner = asRecord(root[k])
    if (inner) candidates.push(inner)
  }
  candidates.push(root)

  const scorePayload = (o: Record<string, unknown>): number => {
    let s = 0
    if (o.summary != null || o.stats != null) s += 4
    const markers = [
      "categoryRows",
      "category_rows",
      "incomeTotal",
      "income_total",
      "expenseTotal",
      "expense_total",
      "monthlyTrendRows",
      "monthly_trend_rows",
      "paymentMethodRows",
      "payment_method_rows",
      "topExpenses",
      "top_expenses",
    ]
    for (const k of markers) {
      if (k in o) s += 1
    }
    return s
  }

  let best: Record<string, unknown> | null = null
  let bestScore = -1
  for (const c of candidates) {
    const sc = scorePayload(c)
    if (sc > bestScore) {
      bestScore = sc
      best = c
    }
  }
  return best ?? dataObj ?? root
}

/** One month bucket from `monthlyTrendRows` (backend-aggregated). */
export type MonthlyTrendRow = {
  month: string
  income: number
  expense: number
  /** Loan EMI / loan_payment outflows for that month. */
  loanPayment: number
  /** Credit card bill payments (transfers to card) for that month. */
  creditCardBillPayment: number
  /** Spending charged to credit cards (optional series). */
  creditCardSpend: number
}

export type DashboardAnalyticsView = {
  summary: {
    income: number
    expenses: number
    netSavings: number
    savingsRate: number
    avgDailySpend: number
    totalFees: number
    totalTransactions: number
    activeSpendDays: number
  }
  categoryBreakdown: { name: string; value: number; color: string }[]
  paymentMethods: { name: string; amount: number; percentage: number; color: string }[]
  topExpenses: { id: string | number; name: string; date: string; amount: number }[]
  monthlyTrends: MonthlyTrendRow[]
  dayOfWeek: { day: string; amount: number }[]
  transactionCounts: { name: string; count: number; color: string }[]
  ccUtilization: { name: string; used: number; total: number; percentage: number }[]
  udhar: { receive: number; pay: number; net: number }
  /** Loan snapshot from dashboard API (`loanOverview` / `loanSummary` / similar). */
  loanOverview: { active: number; monthlyEmi: number; principal: number } | null
}

function mapCategoryRows(rows: unknown[]): { name: string; value: number }[] {
  const out: { name: string; value: number }[] = []
  for (const r of rows) {
    const o = asRecord(r)
    if (!o) continue
    const name = pickStr(o, ["categoryName", "category_name", "name", "category", "title", "label"])
    const value = pickNum(o, ["amount", "total", "value", "sum", "expense"])
    if (value <= 0) continue
    out.push({ name: name || "Uncategorized", value })
  }
  return out
}

function mapPaymentRows(rows: unknown[]): { name: string; amount: number; percentage: number }[] {
  const raw: { name: string; amount: number; percentage: number }[] = []
  for (const r of rows) {
    const o = asRecord(r)
    if (!o) continue
    const name = pickStr(o, ["name", "method", "paymentMethod", "label", "type"])
    const amount = pickNum(o, ["amount", "total", "value", "sum"])
    let pct = pickNum(o, ["percentage", "percent", "share", "ratio"])
    if (pct > 0 && pct <= 1) pct *= 100
    raw.push({ name: name || "Other", amount, percentage: pct })
  }
  const totalAmt = raw.reduce((s, x) => s + x.amount, 0)
  return raw.map((x) => {
    let percentage = x.percentage
    if (percentage <= 0 && totalAmt > 0) {
      percentage = Math.round((x.amount / totalAmt) * 1000) / 10
    }
    return { ...x, percentage }
  })
}

function mapTopExpenses(rows: unknown[]): DashboardAnalyticsView["topExpenses"] {
  const out: DashboardAnalyticsView["topExpenses"] = []
  let i = 0
  for (const r of rows) {
    const o = asRecord(r)
    if (!o) continue
    const name = pickStr(o, ["name", "title", "description", "merchant", "category"])
    const amount = pickNum(o, ["amount", "total", "value"])
    const dateRaw = pickStr(o, ["date", "txnDate", "transactionDate", "createdAt"])
    const idRaw = o.id ?? o.transactionId ?? i + 1
    const id = typeof idRaw === "string" || typeof idRaw === "number" ? idRaw : String(i + 1)
    i += 1
    out.push({
      id,
      name: name || "Expense",
      date: dateRaw,
      amount,
    })
  }
  out.sort((a, b) => b.amount - a.amount)
  return out.slice(0, 5)
}

function mapMonthlyTrends(rows: unknown[]): MonthlyTrendRow[] {
  const out: MonthlyTrendRow[] = []
  for (const r of rows) {
    const o = asRecord(r)
    if (!o) continue
    const month = pickStr(o, ["month", "label", "period", "name", "key"])
    const income = pickNum(o, ["income", "incomeTotal", "totalIncome"])
    const expense = pickNum(o, ["expense", "expenseTotal", "totalExpense", "spend"])
    const loanPayment = pickNum(o, [
      "loanPayment",
      "loan_payment",
      "loanPayments",
      "totalLoanPayment",
      "emiOutflow",
    ])
    const creditCardBillPayment = pickNum(o, [
      "creditCardBillPayment",
      "credit_card_bill_payment",
      "cardBillPayment",
      "creditCardPayment",
    ])
    const creditCardSpend = pickNum(o, [
      "creditCardSpend",
      "credit_card_spend",
      "cardSpend",
      "creditCardExpense",
    ])
    out.push({
      month: month || "—",
      income,
      expense,
      loanPayment,
      creditCardBillPayment,
      creditCardSpend,
    })
  }
  return out
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

const DOW_CHART_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const

function normalizeDayLabel(raw: string): string {
  const s = raw.trim()
  if (DOW_CHART_ORDER.includes(s as (typeof DOW_CHART_ORDER)[number])) return s
  const lower = s.toLowerCase()
  const map: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  }
  return map[lower] ?? s
}

function orderDayOfWeekRows(
  rows: { day: string; amount: number }[]
): DashboardAnalyticsView["dayOfWeek"] {
  if (rows.length === 0) return rows
  const rank = (d: string) => {
    const label = normalizeDayLabel(d).slice(0, 3)
    const i = DOW_CHART_ORDER.indexOf(label as (typeof DOW_CHART_ORDER)[number])
    return i >= 0 ? i : 99
  }
  return [...rows].sort((a, b) => rank(a.day) - rank(b.day))
}

function mapDayOfWeek(rows: unknown[]): DashboardAnalyticsView["dayOfWeek"] {
  const out: DashboardAnalyticsView["dayOfWeek"] = []
  for (const r of rows) {
    const o = asRecord(r)
    if (!o) continue
    let day = pickStr(o, ["day", "weekday", "dayOfWeek", "label", "name"])
    const n = toNum(o.dayOfWeek ?? o.dow ?? o.weekdayIndex)
    if (!day && n >= 0 && n <= 6) day = DAY_LABELS[Math.floor(n)] ?? ""
    const amount = pickNum(o, ["amount", "total", "expense", "spend", "value"])
    out.push({ day: day ? normalizeDayLabel(day) : "—", amount })
  }
  return orderDayOfWeekRows(out)
}

function mapTypeCounts(rows: unknown[]): DashboardAnalyticsView["transactionCounts"] {
  const out: DashboardAnalyticsView["transactionCounts"] = []
  let i = 0
  for (const r of rows) {
    const o = asRecord(r)
    if (!o) continue
    const name = pickStr(o, ["name", "type", "transactionType", "label", "kind"])
    const count = Math.round(pickNum(o, ["count", "total", "n"]))
    out.push({
      name: name || "Type",
      count: count > 0 ? count : 0,
      color: TYPE_DOT_CLASSES[i % TYPE_DOT_CLASSES.length],
    })
    i += 1
  }
  return out
}

function mapCardUtilization(rows: unknown[]): DashboardAnalyticsView["ccUtilization"] {
  const out: DashboardAnalyticsView["ccUtilization"] = []
  for (const r of rows) {
    const o = asRecord(r)
    if (!o) continue
    const name = pickStr(o, ["name", "cardName", "accountName", "label", "title"])
    const used = pickNum(o, ["used", "outstanding", "currentOutstanding", "spent"])
    const total = pickNum(o, ["total", "limit", "creditLimit", "max"])
    let pct = pickNum(o, ["percentage", "utilization", "utilizationPercent", "percent"])
    if (pct > 0 && pct <= 1) pct *= 100
    if (pct <= 0 && total > 0) {
      pct = Math.round((used / total) * 1000) / 10
    }
    pct = Math.min(100, Math.max(0, pct))
    out.push({
      name: name || "Card",
      used,
      total,
      percentage: pct,
    })
  }
  return out
}

function pickLoanOverview(
  payload: Record<string, unknown>
): DashboardAnalyticsView["loanOverview"] {
  const lo = asRecord(
    payload.loanOverview ??
      payload.loan_overview ??
      payload.loanSummary ??
      payload.loan_summary ??
      payload.loanStats ??
      payload.loan_stats
  )
  if (!lo) return null
  const active = pickNum(lo, ["active", "activeLoans", "activeLoanCount", "count"])
  const monthlyEmi = pickNum(lo, ["monthlyEmi", "emiTotal", "totalEmi", "emi", "monthly_emi"])
  const principal = pickNum(lo, [
    "totalPrincipal",
    "principal",
    "principalTotal",
    "total_principal",
  ])
  if (active <= 0 && monthlyEmi <= 0 && principal <= 0) return null
  return { active, monthlyEmi, principal }
}

const SUMMARY_INCOME_KEYS = ["incomeTotal", "income", "income_total"] as const
const SUMMARY_EXPENSE_KEYS = ["expenseTotal", "expenses", "expense", "expense_total"] as const
const SUMMARY_NET_KEYS = ["netSavings", "savings", "net_savings"] as const
const SUMMARY_RATE_KEYS = ["savingsRate", "savings_rate"] as const
const SUMMARY_AVG_SPEND_KEYS = ["avgDailySpend", "averageDailySpend", "avg_daily_spend"] as const
const STATS_TX_KEYS = ["totalTransactions", "transactionCount", "total_transactions"] as const
const STATS_FEES_KEYS = ["totalFeesPaid", "totalFees", "fees", "total_fees_paid"] as const
const STATS_SPEND_DAYS_KEYS = ["activeSpendDays", "spendDays", "active_spend_days"] as const

function buildView(payload: Record<string, unknown>): DashboardAnalyticsView {
  const summaryBlock = asRecord(payload.summary) ?? asRecord(payload.summary_stats)
  const statsBlock = asRecord(payload.stats) ?? asRecord(payload.statistics)

  const income = summaryBlock
    ? pickNum(summaryBlock, [...SUMMARY_INCOME_KEYS])
    : pickNum(payload, [...SUMMARY_INCOME_KEYS])
  const expenses = summaryBlock
    ? pickNum(summaryBlock, [...SUMMARY_EXPENSE_KEYS])
    : pickNum(payload, [...SUMMARY_EXPENSE_KEYS])
  const netSavings = summaryBlock
    ? pickNum(summaryBlock, [...SUMMARY_NET_KEYS])
    : pickNum(payload, [...SUMMARY_NET_KEYS])
  const savingsRateRaw = summaryBlock
    ? pickNum(summaryBlock, [...SUMMARY_RATE_KEYS])
    : pickNum(payload, [...SUMMARY_RATE_KEYS])
  const avgDailySpend = summaryBlock
    ? pickNum(summaryBlock, [...SUMMARY_AVG_SPEND_KEYS])
    : pickNum(payload, [...SUMMARY_AVG_SPEND_KEYS])

  const totalTransactions = statsBlock
    ? pickNum(statsBlock, [...STATS_TX_KEYS])
    : pickNum(payload, [...STATS_TX_KEYS])
  const totalFees = statsBlock
    ? pickNum(statsBlock, [...STATS_FEES_KEYS])
    : pickNum(payload, [...STATS_FEES_KEYS])
  const activeSpendDays = statsBlock
    ? pickNum(statsBlock, [...STATS_SPEND_DAYS_KEYS])
    : pickNum(payload, [...STATS_SPEND_DAYS_KEYS])

  const categoryRows = mapCategoryRows(
    pluckArray(payload, "categoryRows", "category_rows", "categories")
  )
  const totalCat = categoryRows.reduce((s, c) => s + c.value, 0)
  const categoryBreakdown: DashboardAnalyticsView["categoryBreakdown"] =
    totalCat > 0
      ? categoryRows.map((c, i) => ({
          name: c.name,
          value: c.value,
          color: CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length],
        }))
      : []

  const paymentRaw = mapPaymentRows(
    pluckArray(payload, "paymentMethodRows", "payment_method_rows", "paymentMethods")
  )
  const paymentMethods = paymentRaw.map((p, i) => ({
    name: p.name,
    amount: p.amount,
    percentage: p.percentage,
    color: PAYMENT_BAR_CLASSES[i % PAYMENT_BAR_CLASSES.length],
  }))

  const udharReceive = pickNum(payload, ["udharReceive", "udhar_receive"])
  const udharPay = pickNum(payload, ["udharPay", "udhar_pay"])
  let udharNet = pickNum(payload, ["udharNet", "udhar_net"])
  if (udharNet === 0 && (udharReceive !== 0 || udharPay !== 0)) {
    udharNet = udharReceive - udharPay
  }

  return {
    summary: {
      income,
      expenses,
      netSavings,
      savingsRate: normalizeSavingsRateDisplay(savingsRateRaw),
      avgDailySpend,
      totalFees,
      totalTransactions,
      activeSpendDays,
    },
    categoryBreakdown,
    paymentMethods,
    topExpenses: mapTopExpenses(
      pluckArray(payload, "topExpenses", "top_expenses", "highestExpenses")
    ),
    monthlyTrends: mapMonthlyTrends(
      pluckArray(payload, "monthlyTrendRows", "monthly_trend_rows", "monthlyTrends")
    ),
    dayOfWeek: mapDayOfWeek(pluckArray(payload, "dayOfWeekRows", "day_of_week_rows", "dayOfWeek")),
    transactionCounts: mapTypeCounts(
      pluckArray(payload, "typeCountRows", "type_count_rows", "transactionTypeCounts")
    ),
    ccUtilization: mapCardUtilization(
      pluckArray(payload, "cardUtilizationRows", "card_utilization_rows", "creditCardUtilization")
    ),
    udhar: {
      receive: udharReceive,
      pay: udharPay,
      net: udharNet,
    },
    loanOverview: pickLoanOverview(payload),
  }
}

/** True when backend sent non-zero loan/CC series for at least one month. */
export function monthlyTrendHasExtendedSeries(rows: MonthlyTrendRow[]): boolean {
  return rows.some((r) => r.loanPayment > 0 || r.creditCardBillPayment > 0 || r.creditCardSpend > 0)
}

export function parseDashboardAnalyticsResponse(
  raw: unknown
): { ok: true; view: DashboardAnalyticsView } | { ok: false; error: string } {
  const payload = extractPayload(raw)
  if (!payload) {
    return { ok: false, error: "Invalid analytics response." }
  }
  try {
    const view = buildView(payload)
    return { ok: true, view }
  } catch {
    return { ok: false, error: "Could not read analytics data." }
  }
}
