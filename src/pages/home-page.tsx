import { createElement, useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowRight,
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AddCommitmentModal } from "@/features/analytics/add-commitment-modal"
import { RecentTransactionRow } from "@/features/entries/recent-transaction-row"
import { useDeleteTransactionFlow } from "@/features/entries/use-delete-transaction-flow"
import { getErrorMessage } from "@/lib/api/errors"
import { getDashboardAccountDisplay } from "@/lib/api/dashboard-account-display"
import type { Account } from "@/lib/api/account-schemas"
import type { DashboardAccountPreview } from "@/lib/api/dashboard-home-schemas"
import {
  buildHorizonBounds,
  commitmentToScheduled,
  filterByHorizon,
  filterMoneyFlowByHorizon,
  formatYyyyMmDd,
  isDateInHorizon,
  incomeTxToMoneyFlowRow,
  mergeMoneyFlowDedupe,
  mergeScheduledItems,
  incomingBucket,
  outgoingBucket,
  scheduledToPayRow,
  scheduledToReceiveRow,
  sortMoneyFlowRows,
  supplementCreditCardItems,
  supplementLoanEmiItems,
  type MoneyFlowRow,
} from "@/lib/home-money-overview"
import { formatCurrency, formatDayMonthShort } from "@/lib/format"
import {
  useGetAccountsQuery,
  useGetCommitmentsQuery,
  useGetDashboardQuery,
  useGetRecentTransactionsQuery,
} from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"
import { cn } from "@/lib/utils"

const DEFAULT_RECENT_LIMIT = 5

const RECENT_LIMIT_PRESETS = [5, 10, 12, 20] as const

const DAY_PRESETS = [
  { label: "Today", days: 1 },
  { label: "+2d", days: 2 },
  { label: "+3d", days: 3 },
  { label: "+7d", days: 7 },
] as const

function accountKindIcon(kind: string) {
  const k = kind.toLowerCase()
  if (k.includes("bank")) return Building2
  if (k.includes("wallet")) return Wallet
  if (k.includes("cash")) return Banknote
  if (k.includes("asset") || k.includes("property")) return Landmark
  if (k.includes("loan")) return Landmark
  if (k.includes("credit")) return CreditCard
  return Wallet
}

function accountKindBadgeLabel(kind: string): string {
  const k = kind.toLowerCase()
  if (k === "credit_card" || k === "creditcard") return "Card"
  if (k === "loan") return "Loan"
  return kind.replace(/_/g, " ") || "Account"
}

export default function HomePage() {
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const [horizonDays, setHorizonDays] = useState(7)
  const [recentLimit, setRecentLimit] = useState(DEFAULT_RECENT_LIMIT)
  const [commitmentOpen, setCommitmentOpen] = useState(false)

  const {
    data: dashboard,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetDashboardQuery({ days: horizonDays, recentLimit })

  const { data: accounts = [] } = useGetAccountsQuery()
  const { data: commitments = [] } = useGetCommitmentsQuery(undefined, { skip: !user })

  const incomeDateRange = useMemo(() => {
    const { start, end } = buildHorizonBounds(horizonDays)
    const lookback = new Date(start)
    lookback.setDate(lookback.getDate() - 45)
    return { fromDate: formatYyyyMmDd(lookback), toDate: formatYyyyMmDd(end) }
  }, [horizonDays])

  const { data: incomeTransactions = [] } = useGetRecentTransactionsQuery(
    {
      type: "income",
      limit: 400,
      fromDate: incomeDateRange.fromDate,
      toDate: incomeDateRange.toDate,
    },
    { skip: !user }
  )

  const payableCommitmentItems = useMemo(() => {
    const { start, end } = buildHorizonBounds(horizonDays)
    return commitments
      .filter(
        (c) => c.status.toLowerCase() === "pending" && c.direction.toLowerCase() === "payable"
      )
      .map(commitmentToScheduled)
      .filter((c) => isDateInHorizon(c.dueDate, start, end))
  }, [commitments, horizonDays])

  const receivableCommitmentItems = useMemo(() => {
    const { start, end } = buildHorizonBounds(horizonDays)
    return commitments
      .filter(
        (c) => c.status.toLowerCase() === "pending" && c.direction.toLowerCase() === "receivable"
      )
      .map(commitmentToScheduled)
      .filter((c) => isDateInHorizon(c.dueDate, start, end))
  }, [commitments, horizonDays])

  const outgoingRows = useMemo(() => {
    if (!dashboard) {
      return { udhar: [] as MoneyFlowRow[], loan: [] as MoneyFlowRow[], card: [] as MoneyFlowRow[] }
    }
    const { start, end } = buildHorizonBounds(horizonDays)
    const merged = mergeScheduledItems(dashboard.toBePaid.items, payableCommitmentItems)
    let inHorizon = filterByHorizon(merged, start, end)
    const loanSup = supplementLoanEmiItems(accounts, end, inHorizon)
    const cardSup = supplementCreditCardItems(accounts, end, [...inHorizon, ...loanSup])
    inHorizon = mergeScheduledItems(inHorizon, [...loanSup, ...cardSup])

    const udhar: typeof inHorizon = []
    const loan: typeof inHorizon = []
    const card: typeof inHorizon = []
    for (const it of inHorizon) {
      const b = outgoingBucket(it)
      if (b === "udhar_borrow") udhar.push(it)
      else if (b === "loan_emi") loan.push(it)
      else card.push(it)
    }
    return {
      udhar: sortMoneyFlowRows(udhar.map(scheduledToPayRow)),
      loan: sortMoneyFlowRows(loan.map(scheduledToPayRow)),
      card: sortMoneyFlowRows(card.map(scheduledToPayRow)),
    }
  }, [dashboard, horizonDays, payableCommitmentItems, accounts])

  const incomingRows = useMemo(() => {
    if (!dashboard) {
      return { udhar: [] as MoneyFlowRow[], income: [] as MoneyFlowRow[] }
    }
    const { start, end } = buildHorizonBounds(horizonDays)
    const merged = mergeScheduledItems(dashboard.incomingMoney.items, receivableCommitmentItems)
    const inHorizon = filterByHorizon(merged, start, end)
    const udharItems = inHorizon.filter((it) => incomingBucket(it) === "udhar_lent")
    const schedIncome = inHorizon.filter((it) => incomingBucket(it) === "income")

    const udharDetail = sortMoneyFlowRows(udharItems.map(scheduledToReceiveRow))

    const schedIncomeRows = schedIncome.map(scheduledToReceiveRow)
    const txRows = incomeTransactions
      .map(incomeTxToMoneyFlowRow)
      .filter((r): r is MoneyFlowRow => r != null)
    const txInHorizon = filterMoneyFlowByHorizon(txRows, start, end)

    const incomeDetail = sortMoneyFlowRows(
      mergeMoneyFlowDedupe([...schedIncomeRows, ...txInHorizon])
    )

    return { udhar: udharDetail, income: incomeDetail }
  }, [dashboard, horizonDays, receivableCommitmentItems, incomeTransactions])

  const txDelete = useDeleteTransactionFlow()

  useEffect(() => {
    if (!isError || !error) return
    const msg = getErrorMessage(error)
    if (/authorization token is required/i.test(msg)) {
      toast.error(msg)
      navigate("/login", { replace: true })
    }
  }, [isError, error, navigate])

  const homeRecentRows = dashboard?.recentTransactions ?? []

  const showSkeleton = isLoading && !dashboard
  const updating = isFetching && dashboard

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-gutter:stable] [scrollbar-width:thin]">
      <AddCommitmentModal open={commitmentOpen} onOpenChange={setCommitmentOpen} />

      <main
        className={cn(
          "flex w-full flex-1 flex-col gap-4 px-4 pb-28 pt-2 transition-opacity",
          updating && "opacity-[0.97]"
        )}
      >
        <ConfirmDeleteDialog
          open={txDelete.confirmOpen}
          onOpenChange={(v) => !v && txDelete.dismiss()}
          title="Delete entry"
          message="Are you sure you want to delete this transaction? This cannot be undone."
          isDeleting={txDelete.isDeleting}
          onConfirm={txDelete.confirmDelete}
        />

        {!showSkeleton && dashboard ? (
          <Card className="overflow-hidden rounded-2xl border-0 bg-primary text-white shadow-xl ring-1 ring-white/10">
            <CardHeader className="px-5 pb-2 pt-5">
              <CardTitle className="text-xl font-bold tracking-tight text-white">
                Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-5 pb-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-white/60">
                  Total balance
                </p>
                <p className="text-3xl font-bold tabular-nums text-white">
                  {formatCurrency(dashboard.summary.totalBalance)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCell
                  icon={TrendingUp}
                  label="Income"
                  value={formatCurrency(dashboard.summary.income)}
                />
                <MetricCell
                  icon={TrendingDown}
                  label="Expenses"
                  value={formatCurrency(dashboard.summary.expenses)}
                />
                <MetricCell
                  icon={CreditCard}
                  label="Card dues"
                  value={formatCurrency(dashboard.summary.cardDues)}
                />
                <MetricCell
                  icon={Users}
                  label="Person dues"
                  value={formatCurrency(dashboard.summary.personDues)}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <Link
                  to="/entries"
                  className="rounded-xl border border-white/25 bg-white/5 px-2 py-2.5 text-center text-[11px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  + Entry
                </Link>
                <Link
                  to="/accounts"
                  className="rounded-xl border border-white/25 bg-white/5 px-2 py-2.5 text-center text-[11px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  + Account
                </Link>
                <button
                  type="button"
                  onClick={() => setCommitmentOpen(true)}
                  className="rounded-xl border border-white/25 bg-white/5 px-2 py-2.5 text-center text-[11px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  + Commitment
                </button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Skeleton className="h-72 w-full rounded-2xl bg-muted" />
        )}

        {isError && !dashboard ? (
          <Card className="rounded-2xl border-destructive/30 bg-destructive/5">
            <CardContent className="flex flex-col gap-3 py-6">
              <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
              <Button
                type="button"
                variant="outline"
                className="w-fit rounded-xl"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {showSkeleton ? <HomeSkeleton /> : null}

        {!showSkeleton && dashboard ? (
          <>
            <MoneyFlowGroupedSection
              title="To Be Paid by Me"
              variant="pay"
              total={dashboard.toBePaid.total}
              horizonDays={horizonDays}
              onHorizonDaysChange={setHorizonDays}
              emptyCopy={`No payments due in the next ${horizonDays} day${horizonDays === 1 ? "" : "s"}.`}
              subsections={[
                {
                  heading: "Borrowed Udhar",
                  rows: outgoingRows.udhar,
                  dateHint: "due",
                  chip: "To pay",
                },
                { heading: "Loan EMI", rows: outgoingRows.loan, dateHint: "due", chip: "EMI" },
                {
                  heading: "Credit card bills",
                  rows: outgoingRows.card,
                  dateHint: "due",
                  chip: "Bill",
                },
              ]}
            />

            <MoneyFlowGroupedSection
              title="Incoming Money"
              variant="receive"
              total={dashboard.incomingMoney.total}
              horizonDays={horizonDays}
              onHorizonDaysChange={setHorizonDays}
              emptyCopy={`No expected incoming in the next ${horizonDays} day${horizonDays === 1 ? "" : "s"}.`}
              subsections={[
                {
                  heading: "Lent Udhar",
                  rows: incomingRows.udhar,
                  dateHint: "expect",
                  chip: "To receive",
                },
                {
                  heading: "Salary / Income",
                  rows: incomingRows.income,
                  dateHint: "expect",
                  chip: "Income",
                },
              ]}
            />

            <div className="grid grid-cols-3 gap-2">
              <Card className="rounded-2xl border-border/60 bg-card py-3 shadow-sm">
                <CardContent className="space-y-1 px-3 pt-0">
                  <Users className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <p className="text-[10px] font-medium text-muted-foreground">To receive</p>
                  <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(dashboard.stats.toReceive)}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/60 bg-card py-3 shadow-sm">
                <CardContent className="space-y-1 px-3 pt-0">
                  <CreditCard className="size-5 text-destructive dark:text-red-400" aria-hidden />
                  <p className="text-[10px] font-medium text-muted-foreground">CC outstanding</p>
                  <p className="text-sm font-bold tabular-nums text-destructive dark:text-red-400">
                    {formatCurrency(dashboard.stats.cardOutstanding)}
                  </p>
                </CardContent>
              </Card>
              <Card className="rounded-2xl border-border/60 bg-card py-3 shadow-sm">
                <CardContent className="space-y-1 px-3 pt-0">
                  <Landmark className="size-5 text-primary" aria-hidden />
                  <p className="text-[10px] font-medium text-muted-foreground">Active loans</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">
                    {dashboard.stats.activeLoans}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-2xl border-border/50 bg-muted/30 py-3">
              <CardContent className="grid grid-cols-2 gap-2 px-4 text-[11px]">
                <div>
                  <p className="text-muted-foreground">Surplus</p>
                  <p className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(dashboard.coverage.surplus)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Available</p>
                  <p className="font-semibold tabular-nums text-foreground">
                    {formatCurrency(dashboard.coverage.availableBalance)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Your accounts</h2>
                <Link
                  to="/accounts"
                  className="flex items-center gap-0.5 text-xs font-semibold text-primary"
                >
                  View all
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              {dashboard.accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounts yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {dashboard.accounts.map((a) => {
                    const full = accounts.find((x) => String(x.id) === a.id)
                    return <AccountPreviewCard key={a.id} account={a} fullAccount={full} />
                  })}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">Recent transactions</h2>
                <Link
                  to="/entries"
                  className="flex items-center gap-0.5 text-xs font-semibold text-primary"
                >
                  View all
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium text-muted-foreground">Show</span>
                {RECENT_LIMIT_PRESETS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRecentLimit(n)}
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
                      recentLimit === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {n}
                  </button>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    className="h-7 w-12 rounded-md px-1 text-center text-[10px] tabular-nums"
                    value={recentLimit}
                    onChange={(e) => {
                      const raw = e.target.value
                      if (raw === "") return
                      const v = parseInt(raw, 10)
                      if (Number.isFinite(v) && v >= 1 && v <= 100) setRecentLimit(v)
                    }}
                    aria-label="Recent transactions count"
                  />
                </div>
              </div>
              {homeRecentRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent transactions yet.</p>
              ) : (
                homeRecentRows.map((tx) => (
                  <RecentTransactionRow
                    key={tx.id}
                    tx={tx}
                    accounts={accounts}
                    onDelete={txDelete.requestDelete}
                  />
                ))
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  )
}

function MetricCell({
  icon: Icon,
  label,
  value,
}: {
  icon: import("react").ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full border border-white/15 bg-white/5">
          <Icon className="size-3.5 text-white/90" aria-hidden />
        </span>
        <p className="text-[10px] font-medium text-white/75">{label}</p>
      </div>
      <p className="pl-10 text-sm font-semibold tabular-nums text-white">{value}</p>
    </div>
  )
}

function MoneyFlowGroupedSection({
  title,
  variant,
  total,
  horizonDays,
  onHorizonDaysChange,
  emptyCopy,
  subsections,
}: {
  title: string
  variant: "pay" | "receive"
  total: number
  horizonDays: number
  onHorizonDaysChange: (d: number) => void
  emptyCopy: string
  subsections: { heading: string; rows: MoneyFlowRow[]; dateHint: "due" | "expect"; chip: string }[]
}) {
  const isPay = variant === "pay"
  const accent = isPay ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
  const chipActive = isPay
    ? "bg-destructive text-destructive-foreground"
    : "bg-emerald-600 text-white dark:bg-emerald-700"

  const anyRows = subsections.some((s) => s.rows.length > 0)

  return (
    <Card
      className={cn(
        "rounded-2xl border bg-card text-card-foreground shadow-sm",
        isPay ? "border-destructive/25" : "border-emerald-500/30 dark:border-emerald-800/50"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle
          className={cn(
            "text-sm font-bold",
            isPay ? "text-destructive" : "text-emerald-700 dark:text-emerald-400"
          )}
        >
          {title}
        </CardTitle>
        <span className={cn("text-sm font-bold tabular-nums", accent)}>
          {formatCurrency(total)}
        </span>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {DAY_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => onHorizonDaysChange(p.days)}
              className={cn(
                "rounded-full px-3 py-1 text-[10px] font-semibold transition-colors",
                horizonDays === p.days
                  ? chipActive
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={1}
              max={365}
              className="h-8 w-14 rounded-lg border-border bg-background px-2 text-center text-xs tabular-nums text-foreground"
              value={horizonDays}
              onChange={(e) => {
                const raw = e.target.value
                if (raw === "") return
                const v = parseInt(raw, 10)
                if (Number.isFinite(v) && v >= 1 && v <= 365) onHorizonDaysChange(v)
              }}
              aria-label="Days ahead"
            />
            <span className="text-[10px] text-muted-foreground">days</span>
          </div>
        </div>
        {!anyRows ? (
          <p className="py-4 text-center text-sm text-muted-foreground">{emptyCopy}</p>
        ) : (
          <div className="space-y-4">
            {subsections.map((sub) => (
              <div key={sub.heading} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {sub.heading}
                </p>
                {sub.rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-2 text-center text-[11px] text-muted-foreground dark:bg-muted/20">
                    None in this window.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {sub.rows.map((row) => (
                      <li
                        key={row.id}
                        className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 dark:bg-muted/10"
                      >
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs">
                          <span className="min-w-0 flex-1 font-semibold text-foreground">
                            {row.title}
                          </span>
                          <span className="shrink-0 text-muted-foreground" aria-hidden>
                            →
                          </span>
                          <span className={cn("shrink-0 font-bold tabular-nums", accent)}>
                            {formatCurrency(row.amount)}
                          </span>
                          <span className="shrink-0 text-muted-foreground" aria-hidden>
                            →
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {sub.dateHint === "due"
                              ? "Due "
                              : sub.chip === "Income"
                                ? "Expected "
                                : ""}
                            {formatDayMonthShort(row.date)}
                          </span>
                          <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {sub.chip}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AccountPreviewCard({
  account,
  fullAccount,
}: {
  account: DashboardAccountPreview
  fullAccount?: Account
}) {
  const KindIcon = accountKindIcon(account.kind)
  const label = accountKindBadgeLabel(account.kind)
  const { amount, label: amountContext } = getDashboardAccountDisplay(account, fullAccount)
  return (
    <div className="flex flex-col rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-1">
        <div className="flex size-9 items-center justify-center rounded-full bg-muted">
          {createElement(KindIcon, { className: "size-4 text-primary", "aria-hidden": true })}
        </div>
        <span className="max-w-18 truncate rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase text-muted-foreground">
          {label}
        </span>
      </div>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {account.name}
      </p>
      {amountContext ? (
        <p className="mt-1 text-[9px] font-medium text-muted-foreground">{amountContext}</p>
      ) : null}
      <p className={cn("text-base font-bold tabular-nums", amountContext ? "mt-0.5" : "mt-1")}>
        {formatCurrency(amount)}
      </p>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-3 gap-2">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-24 w-full rounded-2xl" />
    </div>
  )
}
