import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  TrendingUp,
  TrendingDown,
  Search,
  Home,
  LayoutGrid,
  Wallet,
  BarChart2,
  CreditCard,
} from "lucide-react"
import { PieChart, Pie, Cell, XAxis, YAxis, Tooltip, BarChart, Bar, Legend } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AddCommitmentModal } from "@/features/analytics/add-commitment-modal"
import { getErrorMessage } from "@/lib/api/errors"
import type { Commitment } from "@/lib/api/commitment-schemas"
import {
  monthlyTrendHasExtendedSeries,
  type DashboardAnalyticsView,
} from "@/lib/api/dashboard-analytics-schemas"
import { formatDate } from "@/lib/format"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useGetCommitmentsQuery, useGetDashboardAnalyticsQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"
import { cn } from "@/lib/utils"

const RANGE_TABS = ["7 Days", "Month", "3 Months", "Year"] as const
const RANGE_TO_DAYS: Record<(typeof RANGE_TABS)[number], number> = {
  "7 Days": 7,
  Month: 30,
  "3 Months": 90,
  Year: 365,
}

const ANALYTICS_SEARCH_DEBOUNCE_MS = 400

function formatExpenseDateLabel(raw: string): string {
  if (!raw?.trim()) return "—"
  const t = Date.parse(raw)
  if (Number.isNaN(t)) return raw
  return formatDate(raw)
}

function formatCommitmentInr(amount: string | number): string {
  const n = Number(String(amount).replace(/,/g, "").trim())
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : String(amount)
}

export default function AnalyticsFullPage() {
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const [activeTab, setActiveTab] = useState<(typeof RANGE_TABS)[number]>("Month")
  const [searchInput, setSearchInput] = useState("")
  const [commitmentOpen, setCommitmentOpen] = useState(false)

  const days = RANGE_TO_DAYS[activeTab] ?? 30
  const debouncedSearch = useDebouncedValue(searchInput, ANALYTICS_SEARCH_DEBOUNCE_MS)
  const searchForApi = debouncedSearch.trim() || undefined
  const searchDebouncePending = searchInput.trim() !== (debouncedSearch.trim() || "")

  const {
    data: dashboardData,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetDashboardAnalyticsQuery(
    { days, includeAll: true, ...(searchForApi ? { search: searchForApi } : {}) },
    { skip: !user }
  )
  const {
    data: commitments = [],
    isLoading: commitmentsLoading,
    isError: commitmentsError,
    error: commitmentsQueryError,
  } = useGetCommitmentsQuery({}, { skip: !user })

  useEffect(() => {
    if (!isError || !error) return
    const msg = getErrorMessage(error)
    if (/authorization token is required/i.test(msg)) {
      toast.error(msg)
      navigate("/login", { replace: true })
    }
  }, [isError, error, navigate])

  const showSkeleton = Boolean(user) && isLoading && !dashboardData
  const analyticsUpdating = isFetching || searchDebouncePending

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain bg-background text-foreground pb-20 font-sans transition-opacity [-ms-overflow-style:none] [scrollbar-gutter:stable] [scrollbar-width:thin]",
        analyticsUpdating && dashboardData && "opacity-95"
      )}
    >
      <AddCommitmentModal open={commitmentOpen} onOpenChange={setCommitmentOpen} />
      <main className="flex-1 max-w-3xl mx-auto w-full p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap justify-start gap-2">
            {RANGE_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card text-muted-foreground border border-border hover:bg-muted/60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full border-border bg-card px-3 py-1.5 text-xs font-semibold text-primary hover:bg-muted"
            onClick={() => setCommitmentOpen(true)}
          >
            + Commitment
          </Button>
        </div>

        {!user ? (
          <Card className="rounded-2xl border-border shadow-sm">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Sign in to load analytics for your account.
            </CardContent>
          </Card>
        ) : isError && !dashboardData ? (
          <Card className="rounded-2xl border-red-100 bg-red-50/50 shadow-sm">
            <CardContent className="py-6 space-y-3 text-center">
              <p className="text-sm text-red-800">{getErrorMessage(error)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void refetch()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : showSkeleton ? (
          <AnalyticsSkeleton />
        ) : dashboardData ? (
          <AnalyticsContent
            dashboardData={dashboardData}
            searchInput={searchInput}
            onSearchChange={setSearchInput}
            searchDebouncePending={searchDebouncePending}
            isSearchFilterActive={Boolean(searchForApi)}
            commitments={commitments}
            commitmentsLoading={commitmentsLoading}
            commitmentsError={commitmentsError}
            commitmentsErrorMessage={
              commitmentsError && commitmentsQueryError
                ? getErrorMessage(commitmentsQueryError)
                : undefined
            }
          />
        ) : null}
      </main>

      <nav className="fixed bottom-0 z-50 flex w-full items-center justify-around border-t border-border bg-background py-3 pb-safe">
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium">Home</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] font-medium">Entries</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <Wallet className="w-5 h-5" />
          <span className="text-[10px] font-medium">Accounts</span>
        </button>
        <button type="button" className="flex flex-col items-center gap-1 text-primary">
          <BarChart2 className="w-5 h-5" />
          <span className="text-[10px] font-bold">Analytics</span>
          <div className="mt-0.5 h-1 w-1 rounded-full bg-primary" />
        </button>
      </nav>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-3 gap-3">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
      </div>
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-40 rounded-2xl" />
      <Skeleton className="h-56 rounded-2xl" />
    </div>
  )
}

type AnalyticsContentProps = {
  dashboardData: DashboardAnalyticsView
  searchInput: string
  onSearchChange: (v: string) => void
  searchDebouncePending: boolean
  isSearchFilterActive: boolean
  commitments: Commitment[]
  commitmentsLoading: boolean
  commitmentsError: boolean
  commitmentsErrorMessage?: string
}

function MeasuredChart({
  className,
  children,
}: {
  className: string
  children: (size: { width: number; height: number }) => React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const obs = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) {
        setSize(null)
        return
      }
      const w = Math.floor(width)
      const h = Math.floor(height)
      setSize((prev) =>
        prev && prev.width === w && prev.height === h ? prev : { width: w, height: h }
      )
    })

    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={containerRef} className={className}>
      {size ? children(size) : null}
    </div>
  )
}

function AnalyticsContent({
  dashboardData,
  searchInput,
  onSearchChange,
  searchDebouncePending,
  isSearchFilterActive,
  commitments,
  commitmentsLoading,
  commitmentsError,
  commitmentsErrorMessage,
}: AnalyticsContentProps) {
  const netPositive = dashboardData.summary.netSavings >= 0
  const udharNet = dashboardData.udhar.net
  const udharNetPositive = udharNet >= 0
  const showExtendedMonthly = monthlyTrendHasExtendedSeries(dashboardData.monthlyTrends)
  const commitmentsSorted = useMemo(
    () => [...commitments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [commitments]
  )

  return (
    <>
      <div className="space-y-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search (filters analytics from server)…"
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="rounded-xl border-border bg-card pl-9 shadow-sm"
            autoComplete="off"
          />
        </div>
        {searchDebouncePending ? (
          <p className="px-0.5 text-[10px] text-muted-foreground">Updating search…</p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl border-border py-4 text-center shadow-sm">
          <div className="flex justify-center mb-1">
            <TrendingUp className="text-emerald-500 w-4 h-4" />
          </div>
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">Income</p>
          <p className="text-sm font-bold text-emerald-600">
            ₹{dashboardData.summary.income.toLocaleString("en-IN")}
          </p>
        </Card>
        <Card className="rounded-2xl border-border py-4 text-center shadow-sm">
          <div className="flex justify-center mb-1">
            <TrendingDown className="text-red-500 w-4 h-4" />
          </div>
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">Expenses</p>
          <p className="text-sm font-bold text-red-600">
            ₹{dashboardData.summary.expenses.toLocaleString("en-IN")}
          </p>
        </Card>
        <Card className="rounded-2xl border-border py-4 text-center shadow-sm">
          <div className="flex justify-center mb-1">
            <Wallet className={cn("w-4 h-4", netPositive ? "text-emerald-500" : "text-red-500")} />
          </div>
          <p className="mb-1 text-[10px] font-medium text-muted-foreground">Net Savings</p>
          <p className={cn("text-sm font-bold", netPositive ? "text-emerald-600" : "text-red-600")}>
            ₹{dashboardData.summary.netSavings.toLocaleString("en-IN")}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-border p-4 shadow-sm">
          <p className="mb-1 text-[10px] text-muted-foreground">Savings Rate</p>
          <p className="text-lg font-bold text-emerald-600">{dashboardData.summary.savingsRate}%</p>
        </Card>
        <Card className="rounded-2xl border-border p-4 shadow-sm">
          <p className="mb-1 text-[10px] text-muted-foreground">Avg Daily Spend</p>
          <p className="text-lg font-bold text-red-600">
            ₹{dashboardData.summary.avgDailySpend.toLocaleString("en-IN")}
          </p>
        </Card>
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-bold">Category Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {dashboardData.categoryBreakdown.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No category data this period.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-1/4 min-w-[96px]">
                <MeasuredChart className="w-full h-[300px] min-h-[300px]">
                  {(size) => (
                    <PieChart width={size.width} height={size.height}>
                      <Pie
                        data={dashboardData.categoryBreakdown}
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        stroke="none"
                      >
                        {dashboardData.categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  )}
                </MeasuredChart>
              </div>
              <div className="w-3/4 space-y-2">
                {dashboardData.categoryBreakdown.map((item) => (
                  <div key={item.name} className="flex justify-between text-xs items-center">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="truncate text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="font-semibold shrink-0">
                      ₹{item.value.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Payment Methods</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {dashboardData.paymentMethods.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">No payment method data.</p>
          ) : (
            dashboardData.paymentMethods.map((method) => (
              <div key={method.name} className="space-y-1.5">
                <div className="flex justify-between text-xs gap-2">
                  <span className="truncate text-muted-foreground">{method.name}</span>
                  <span className="font-bold shrink-0">
                    ₹{method.amount.toLocaleString("en-IN")} ({method.percentage}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", method.color)}
                    style={{ width: `${Math.min(100, method.percentage)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Top 5 Expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 pt-0">
          {dashboardData.topExpenses.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {isSearchFilterActive ? "No matches for your search." : "No expenses in this period."}
            </p>
          ) : (
            dashboardData.topExpenses.map((expense, index) => (
              <div
                key={`${expense.id}-${index}`}
                className="flex items-center justify-between gap-2 border-b border-border/40 py-3 last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold text-destructive">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">{expense.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatExpenseDateLabel(expense.date)}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-red-500 shrink-0">
                  ₹{expense.amount.toLocaleString("en-IN")}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-bold">Monthly Trends</CardTitle>
          <p className="pt-1 text-[10px] font-normal text-muted-foreground">
            Income, expenses, and optional loan / credit-card series from the dashboard API.
          </p>
        </CardHeader>
        <CardContent className="min-w-0 pt-4">
          {dashboardData.monthlyTrends.length === 0 ? (
            <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No monthly trend data.
            </p>
          ) : (
            <div className="min-w-0">
              <MeasuredChart className="w-full h-[300px] min-h-[300px]">
                {(size) => (
                  <BarChart
                    width={size.width}
                    height={size.height}
                    data={dashboardData.monthlyTrends}
                    barSize={showExtendedMonthly ? 10 : 14}
                    margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="month"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      dy={10}
                    />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(val) => `₹${val / 1000}k`}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        color: "hsl(var(--foreground))",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Legend
                      iconType="square"
                      wrapperStyle={{ fontSize: "9px", color: "hsl(var(--muted-foreground))" }}
                    />
                    <Bar dataKey="income" name="Income" fill="#22c55e" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[2, 2, 0, 0]} />
                    {showExtendedMonthly ? (
                      <>
                        <Bar
                          dataKey="loanPayment"
                          name="Loan payment"
                          fill="#8b5cf6"
                          radius={[2, 2, 0, 0]}
                        />
                        <Bar
                          dataKey="creditCardBillPayment"
                          name="CC bill pay"
                          fill="#3b82f6"
                          radius={[2, 2, 0, 0]}
                        />
                        <Bar
                          dataKey="creditCardSpend"
                          name="CC spend"
                          fill="#06b6d4"
                          radius={[2, 2, 0, 0]}
                        />
                      </>
                    ) : null}
                  </BarChart>
                )}
              </MeasuredChart>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-0">
          <CardTitle className="text-sm font-bold">Spending by Day of Week</CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 pt-4">
          {dashboardData.dayOfWeek.length === 0 ? (
            <p className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No day-of-week data.
            </p>
          ) : (
            <div className="min-w-0">
              <MeasuredChart className="w-full h-[300px] min-h-[300px]">
                {(size) => (
                  <BarChart
                    width={size.width}
                    height={size.height}
                    data={dashboardData.dayOfWeek}
                    barSize={25}
                  >
                    <XAxis
                      dataKey="day"
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      dy={10}
                    />
                    <YAxis
                      fontSize={10}
                      tickLine={false}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(val) => `₹${val / 1000}k`}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        color: "hsl(var(--foreground))",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="amount" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                )}
              </MeasuredChart>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl border-border p-4 shadow-sm">
          <p className="mb-1 text-[10px] text-muted-foreground">Total Fees Paid</p>
          <p className="text-lg font-bold text-red-500">
            ₹{dashboardData.summary.totalFees.toLocaleString("en-IN")}
          </p>
        </Card>
        <Card className="rounded-2xl border-border p-4 shadow-sm">
          <p className="mb-1 text-[10px] text-muted-foreground">Total Transactions</p>
          <p className="text-lg font-bold text-foreground">
            {dashboardData.summary.totalTransactions}
          </p>
        </Card>
        <Card className="rounded-2xl border-border p-4 shadow-sm">
          <p className="mb-1 text-[10px] text-muted-foreground">Active Spend Days</p>
          <p className="text-lg font-bold text-foreground">
            {dashboardData.summary.activeSpendDays}
          </p>
        </Card>
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Transaction Count by Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 pt-0">
          {dashboardData.transactionCounts.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No type breakdown.</p>
          ) : (
            dashboardData.transactionCounts.map((type, index) => (
              <div
                key={`${type.name}-${index}`}
                className="flex items-center justify-between border-b border-border/40 py-3 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div className={cn("w-1.5 h-1.5 rounded-full", type.color)} />
                  <span className="text-xs font-bold text-foreground">{type.name}</span>
                </div>
                <span className="text-xs font-bold text-foreground">{type.count}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> CC Utilization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          {dashboardData.ccUtilization.length === 0 ? (
            <p className="text-sm text-muted-foreground">No credit card data.</p>
          ) : (
            dashboardData.ccUtilization.map((card, index) => (
              <div key={`${card.name}-${index}`} className="space-y-1.5">
                <div className="flex justify-between text-xs gap-2">
                  <span className="truncate font-bold text-foreground">{card.name}</span>
                  <span className="shrink-0 text-right text-muted-foreground">
                    ₹{card.used.toLocaleString("en-IN")} / ₹{card.total.toLocaleString("en-IN")} (
                    {card.percentage}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, card.percentage)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {dashboardData.loanOverview ? (
        <Card className="rounded-2xl border-border shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="text-muted-foreground">🏛️</span> Loan Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 flex justify-between px-6">
            <div className="w-[30%] rounded-sm bg-muted py-3 text-center">
              <p className="mb-1 text-[10px] text-muted-foreground">Active</p>
              <p className="text-sm font-bold text-foreground">
                {dashboardData.loanOverview.active}
              </p>
            </div>
            <div className="w-[30%] rounded-sm bg-muted py-3 text-center">
              <p className="mb-1 text-[10px] text-muted-foreground">Monthly EMI</p>
              <p className="text-sm font-bold text-red-500">
                ₹{dashboardData.loanOverview.monthlyEmi.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="w-[30%] rounded-sm bg-muted py-3 text-center">
              <p className="mb-1 text-[10px] text-muted-foreground">Total Principal</p>
              <p className="text-sm font-bold text-foreground">
                ₹{dashboardData.loanOverview.principal.toLocaleString("en-IN")}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <span className="text-muted-foreground">👥</span> Udhar Position
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-[10px] text-emerald-700 mb-1">To Receive</p>
              <p className="text-base font-bold text-emerald-600">
                ₹{dashboardData.udhar.receive.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
              <p className="text-[10px] text-red-700 mb-1">To Pay</p>
              <p className="text-base font-bold text-red-500">
                ₹{dashboardData.udhar.pay.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
          <div className="text-center">
            <span className="text-xs text-muted-foreground">Net: </span>
            <span
              className={cn(
                "text-xs font-bold",
                udharNetPositive ? "text-emerald-600" : "text-red-500"
              )}
            >
              {udharNet < 0 ? "-" : ""}₹{Math.abs(udharNet).toLocaleString("en-IN")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold">Commitments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 pt-0">
          {commitmentsLoading ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Loading commitments…</p>
          ) : commitmentsError ? (
            <p className="text-sm text-destructive py-3">
              {commitmentsErrorMessage ?? "Could not load commitments."}
            </p>
          ) : commitmentsSorted.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No commitments yet.</p>
          ) : (
            commitmentsSorted.map((c) => (
              <div
                key={c.id}
                className="flex flex-col gap-1 border-b border-border/40 py-3 last:border-0"
              >
                <div className="flex justify-between gap-2 items-start">
                  <span className="text-xs font-bold text-foreground">{c.title}</span>
                  <span className="shrink-0 text-xs font-bold text-foreground tabular-nums">
                    ₹{formatCommitmentInr(c.amount)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                  <span>{c.dueDate}</span>
                  <span aria-hidden>·</span>
                  <span>{c.direction}</span>
                  <span aria-hidden>·</span>
                  <span>{c.kind}</span>
                  <span aria-hidden>·</span>
                  <span className="capitalize">{c.status}</span>
                </div>
                {c.note?.trim() ? (
                  <p className="line-clamp-2 text-[10px] text-muted-foreground">{c.note.trim()}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  )
}
