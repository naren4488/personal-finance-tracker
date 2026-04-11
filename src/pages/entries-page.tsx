import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import {
  ArrowLeftRight,
  ArrowRightLeft,
  Banknote,
  ChevronDown,
  FileText,
  IndianRupee,
  Search,
  Users,
} from "lucide-react"
import { ConfirmDeleteDialog } from "@/components/confirm-delete-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { AddAccountSheet } from "@/features/accounts/add-account-sheet"
import { AddUdharEntrySheet } from "@/features/accounts/add-udhar-entry-sheet"
import { UdharDetailsModal } from "@/features/accounts/udhar-details-modal"
import { UdharEntryRow } from "@/features/accounts/udhar-entry-row"
import { AddTransactionModal } from "@/features/entries/add-transaction-modal"
import { RecentTransactionRow } from "@/features/entries/recent-transaction-row"
import { TransferTransactionRow } from "@/features/entries/transfer-transaction-row"
import { useDeleteTransactionFlow } from "@/features/entries/use-delete-transaction-flow"
import { accountSelectLabel, type Account } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import type { TransactionType } from "@/lib/api/schemas"
import {
  getTransferRouteLabels,
  inferUdharPersonName,
  isRecentTransactionLinkedToLoanOrCard,
  isUdharRecentTransaction,
  parseSignedAmountString,
  type RecentTransaction,
  udharDirectionLabel,
} from "@/lib/api/transaction-schemas"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { useGetAccountsQuery, useGetRecentTransactionsQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

type EntrySegment = "txns" | "expenses" | "udhar" | "transfer"
type TimePreset = "7d" | "month" | "3m" | "year" | "all"

/** Recent list cap for entries (time range + filters apply on the client). */
const RECENT_TX_LIMIT = 400

const ENTRY_SEGMENTS: {
  id: EntrySegment
  label: string
  icon: typeof Banknote
}[] = [
  { id: "txns", label: "Txns", icon: ArrowLeftRight },
  { id: "expenses", label: "Expenses", icon: Banknote },
  { id: "transfer", label: "Transfer", icon: ArrowRightLeft },
  { id: "udhar", label: "Udhar", icon: Users },
]

const TIME_PRESETS: { id: TimePreset; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "month", label: "Month" },
  { id: "3m", label: "3M" },
  { id: "year", label: "Year" },
  { id: "all", label: "All" },
]

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function transactionInTimeRange(dateStr: string, preset: TimePreset, now: Date): boolean {
  if (preset === "all") return true
  const txDay = startOfLocalDay(new Date(`${dateStr}T12:00:00`))
  const today = startOfLocalDay(now)

  if (preset === "7d") {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return txDay >= start && txDay <= today
  }
  if (preset === "month") {
    return txDay.getMonth() === today.getMonth() && txDay.getFullYear() === today.getFullYear()
  }
  if (preset === "3m") {
    const start = new Date(today)
    start.setMonth(start.getMonth() - 3)
    return txDay >= start && txDay <= today
  }
  if (preset === "year") {
    return txDay.getFullYear() === today.getFullYear()
  }
  return true
}

function filterBySegmentRecent(
  list: RecentTransaction[],
  segment: EntrySegment,
  accounts: Account[]
): RecentTransaction[] {
  const keep = (t: RecentTransaction) => !isRecentTransactionLinkedToLoanOrCard(t, accounts)
  if (segment === "txns") return list.filter(keep)
  if (segment === "expenses") return list.filter((t) => t.type === "expense" && keep(t))
  if (segment === "transfer") return list.filter((t) => t.type === "transfer" && keep(t))
  return []
}

function headerTotalLabel(
  segment: EntrySegment,
  list: RecentTransaction[]
): { text: string; className: string } {
  if (segment === "expenses") {
    const total = list.reduce((s, t) => {
      if (t.type !== "expense") return s
      return s + Math.abs(parseSignedAmountString(t.signedAmount))
    }, 0)
    return {
      text: formatCurrency(total),
      className: "font-bold tabular-nums text-destructive",
    }
  }
  if (segment === "txns") {
    const net = list.reduce((acc, t) => acc + parseSignedAmountString(t.signedAmount), 0)
    return {
      text: formatCurrency(net),
      className: cn(
        "font-bold tabular-nums",
        net > 0 ? "text-income" : net < 0 ? "text-destructive" : "text-destructive"
      ),
    }
  }
  return {
    text: formatCurrency(0),
    className: "font-bold tabular-nums text-muted-foreground",
  }
}

export default function EntriesPage() {
  const navigate = useNavigate()

  const [segment, setSegment] = useState<EntrySegment>("txns")
  const [timePreset, setTimePreset] = useState<TimePreset>("month")
  const [search, setSearch] = useState("")
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [txModalInitialType, setTxModalInitialType] = useState<TransactionType>("expense")
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [udharSheetOpen, setUdharSheetOpen] = useState(false)
  const [addAccountSheetOpen, setAddAccountSheetOpen] = useState(false)
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | TransactionType>("all")
  const [txAccountFilter, setTxAccountFilter] = useState<string>("all")
  const [selectedUdharTx, setSelectedUdharTx] = useState<RecentTransaction | null>(null)
  const txDelete = useDeleteTransactionFlow()

  const user = useAppSelector((s) => s.auth.user)
  const {
    data: recentTransactions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetRecentTransactionsQuery(RECENT_TX_LIMIT)

  const {
    data: accounts = [],
    isError: accountsQueryError,
    error: accountsError,
  } = useGetAccountsQuery(undefined, { skip: !user })

  useEffect(() => {
    if (!isError || !error) return
    const msg = getErrorMessage(error)
    if (/authorization token is required/i.test(msg)) {
      toast.error(msg)
      navigate("/login", { replace: true })
    }
  }, [isError, error, navigate])

  useEffect(() => {
    if (!accountsQueryError || !accountsError) return
    const msg = getErrorMessage(accountsError)
    if (/authorization token is required/i.test(msg)) {
      toast.error(msg)
      navigate("/login", { replace: true })
    }
  }, [accountsQueryError, accountsError, navigate])

  const udharTransactions = useMemo(
    () =>
      recentTransactions
        .filter(isUdharRecentTransaction)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [recentTransactions]
  )
  const selectedUdharPersonEntries = useMemo(() => {
    if (!selectedUdharTx) return []
    const selectedName = inferUdharPersonName(selectedUdharTx).toLowerCase()
    return udharTransactions.filter((tx) => inferUdharPersonName(tx).toLowerCase() === selectedName)
  }, [selectedUdharTx, udharTransactions])

  const filtered = useMemo(() => {
    const now = new Date()
    const q = search.trim().toLowerCase()
    let list = filterBySegmentRecent(recentTransactions, segment, accounts)
    list = list.filter((t) => transactionInTimeRange(t.date, timePreset, now))
    if (q) {
      list = list.filter((t) => {
        const base = `${t.title} ${t.subtitle}`.toLowerCase()
        if (t.type === "transfer") {
          const { fromLabel, toLabel } = getTransferRouteLabels(t, accounts)
          const route = `${fromLabel} ${toLabel}`.toLowerCase()
          return base.includes(q) || route.includes(q) || q.includes("transfer")
        }
        return base.includes(q)
      })
    }

    if (segment === "txns") {
      if (txTypeFilter !== "all") {
        list = list.filter((t) => t.type === txTypeFilter)
      }
      if (txAccountFilter !== "all") {
        list = list.filter((t) => {
          if (t.type === "transfer") {
            return (
              t.accountId === txAccountFilter ||
              (typeof t.toAccountId === "string" && t.toAccountId === txAccountFilter)
            )
          }
          if (t.accountId) return t.accountId === txAccountFilter
          return true
        })
      }
    }

    if (segment === "expenses" && txAccountFilter !== "all") {
      list = list.filter((t) => t.accountId === txAccountFilter)
    }

    if (segment === "transfer" && txAccountFilter !== "all") {
      list = list.filter((t) => {
        return (
          t.accountId === txAccountFilter ||
          (typeof t.toAccountId === "string" && t.toAccountId === txAccountFilter)
        )
      })
    }

    return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [recentTransactions, segment, timePreset, search, txTypeFilter, txAccountFilter, accounts])

  const entriesHasList = useMemo(() => {
    if (segment === "txns" || segment === "expenses" || segment === "transfer") {
      return !isLoading && !isError && filtered.length > 0
    }
    if (segment === "udhar") {
      return !isLoading && !isError && udharTransactions.length > 0
    }
    return false
  }, [segment, isLoading, isError, filtered.length, udharTransactions.length])

  const totalDisplay = headerTotalLabel(segment, filtered)

  function openTxModalWithType(initial: TransactionType) {
    setTxModalInitialType(initial)
    setTxModalOpen(true)
  }

  function openEntriesHeaderAdd() {
    if (segment === "txns") openTxModalWithType("expense")
    else if (segment === "expenses") setExpenseModalOpen(true)
    else if (segment === "transfer") openTxModalWithType("transfer")
    else if (segment === "udhar") setUdharSheetOpen(true)
  }

  const headerAddAriaLabel =
    segment === "txns"
      ? "Add transaction"
      : segment === "expenses"
        ? "Add expense"
        : segment === "transfer"
          ? "Add transfer"
          : segment === "udhar"
            ? "Add udhar entry"
            : "Add entry"

  const pageTitle =
    segment === "txns"
      ? "Transactions"
      : segment === "expenses"
        ? "All Expenses"
        : segment === "transfer"
          ? "Transfers"
          : segment === "udhar"
            ? "Udhar (Lend & Borrow)"
            : "All Entries"
  const showHeaderTotal = segment === "txns" || segment === "expenses"
  const showTimeAndSearch = segment !== "udhar"
  const searchPlaceholder =
    segment === "expenses"
      ? "Search expenses…"
      : segment === "txns"
        ? "Search transactions…"
        : segment === "transfer"
          ? "Search transfers…"
          : "Search entries…"
  const emptyTitle =
    segment === "txns"
      ? "No transactions found"
      : segment === "expenses"
        ? "No expenses found"
        : segment === "transfer"
          ? ""
          : segment === "udhar"
            ? "No udhar entries"
            : "No entries found"
  const emptySubtitle =
    segment === "txns"
      ? "No transactions match your filters"
      : segment === "expenses"
        ? "No expenses match your filters"
        : segment === "transfer"
          ? ""
          : segment === "udhar"
            ? "Add an udhar entry to track money given or taken"
            : "No entries match your filters"

  return (
    <main className="min-h-0 flex-1 bg-background px-4 py-4 pb-28">
      <AddAccountSheet open={addAccountSheetOpen} onOpenChange={setAddAccountSheetOpen} />
      <AddTransactionModal
        open={txModalOpen}
        onOpenChange={setTxModalOpen}
        initialType={txModalInitialType}
        onOpenAddAccount={() => {
          setTxModalOpen(false)
          setAddAccountSheetOpen(true)
        }}
      />
      <AddTransactionModal
        open={expenseModalOpen}
        onOpenChange={setExpenseModalOpen}
        expenseFlow
        onOpenAddAccount={() => {
          setExpenseModalOpen(false)
          setAddAccountSheetOpen(true)
        }}
      />
      <AddUdharEntrySheet open={udharSheetOpen} onOpenChange={setUdharSheetOpen} />
      <UdharDetailsModal
        open={!!selectedUdharTx}
        onOpenChange={(v) => {
          if (!v) setSelectedUdharTx(null)
        }}
        personName={selectedUdharTx ? inferUdharPersonName(selectedUdharTx) : ""}
        entries={selectedUdharPersonEntries}
        onDeleteEntry={txDelete.requestDelete}
      />
      <ConfirmDeleteDialog
        open={txDelete.confirmOpen}
        onOpenChange={(v) => !v && txDelete.dismiss()}
        title="Delete entry"
        message="Are you sure you want to delete this transaction? This cannot be undone."
        isDeleting={txDelete.isDeleting}
        onConfirm={txDelete.confirmDelete}
      />

      <div className="mb-3 grid grid-cols-4 gap-1" role="tablist" aria-label="Entry categories">
        {ENTRY_SEGMENTS.map(({ id, label, icon: Icon }) => {
          const active = segment === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`entries-tab-${id}`}
              className={cn(
                "flex min-w-0 flex-row items-center justify-center gap-0.5 rounded-full px-1.5 py-1.5 text-center text-[10px] font-semibold leading-none transition-colors sm:gap-1 sm:px-2 sm:text-xs",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/80 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              onClick={() => setSegment(id)}
            >
              <Icon
                className="size-3.5 shrink-0 sm:size-4"
                strokeWidth={active ? 2.25 : 2}
                aria-hidden
              />
              <span className="truncate">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h1 className="text-lg font-bold tracking-tight text-foreground">{pageTitle}</h1>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 sm:ml-auto">
          {showHeaderTotal && !isLoading && !isError ? (
            <span className={totalDisplay.className}>{totalDisplay.text}</span>
          ) : showHeaderTotal && isLoading ? (
            <Skeleton className="h-6 w-16 rounded-md" />
          ) : null}
          {entriesHasList ? (
            <Button
              type="button"
              variant="link"
              className="h-auto shrink-0 p-0 text-sm font-semibold text-primary"
              onClick={openEntriesHeaderAdd}
              aria-label={headerAddAriaLabel}
            >
              + Add
            </Button>
          ) : null}
        </div>
      </div>

      {showTimeAndSearch && (
        <>
          <div
            className="mb-3 flex flex-wrap gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-0.5"
            role="group"
            aria-label="Time range"
          >
            {TIME_PRESETS.map(({ id, label }) => {
              const active = timePreset === id
              return (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setTimePreset(id)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {(segment === "txns" || segment === "expenses" || segment === "transfer") && (
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
              {segment === "txns" && (
                <div className="relative min-w-0 flex-1 sm:max-w-[11rem]">
                  <select
                    value={txTypeFilter}
                    onChange={(e) => setTxTypeFilter(e.target.value as "all" | TransactionType)}
                    className="h-10 w-full appearance-none rounded-full border border-border/80 bg-muted/70 px-3.5 pr-9 text-xs font-semibold text-foreground outline-none"
                    aria-label="Filter by type"
                  >
                    <option value="all">All types</option>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                    <option value="transfer">Transfer</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "relative min-w-0 flex-1 sm:max-w-[11rem]",
                  segment !== "txns" && "sm:max-w-full"
                )}
              >
                <select
                  value={txAccountFilter}
                  onChange={(e) => setTxAccountFilter(e.target.value)}
                  className="h-10 w-full appearance-none rounded-full border border-border/80 bg-muted/70 px-3.5 pr-9 text-xs font-semibold text-foreground outline-none"
                  aria-label="Filter by account"
                >
                  <option value="all">All accounts</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountSelectLabel(a)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          )}

          <label className="sr-only" htmlFor="entries-search">
            {searchPlaceholder.replace("…", "")}
          </label>
          <div className="relative mb-4">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              strokeWidth={2}
              aria-hidden
            />
            <Input
              id="entries-search"
              type="search"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-xl border-border/80 bg-muted/40 pl-10"
              autoComplete="off"
            />
          </div>
        </>
      )}

      {isError && (
        <div className="mb-4 space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => void refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {isLoading && !isError && (
        <div className="space-y-2">
          <Skeleton className="h-18 w-full rounded-2xl" />
          <Skeleton className="h-18 w-full rounded-2xl" />
          <Skeleton className="h-18 w-full rounded-2xl" />
        </div>
      )}

      {!isLoading && !isError && !entriesHasList && (
        <div
          className={cn(
            "flex min-h-[min(52vh,22rem)] flex-col items-center justify-center px-6 py-12 text-center",
            segment === "transfer"
              ? ""
              : "rounded-2xl border border-dashed border-border/90 bg-card"
          )}
        >
          {segment === "transfer" ? null : (
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/80">
              {segment === "expenses" ? (
                <div className="relative flex size-10 items-center justify-center">
                  <FileText className="size-8 text-primary" strokeWidth={2} aria-hidden />
                  <IndianRupee
                    className="absolute -right-0.5 -bottom-0.5 size-4 text-primary"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                </div>
              ) : segment === "udhar" ? (
                <Users className="size-7 text-primary" strokeWidth={2} aria-hidden />
              ) : (
                <Banknote className="size-7 text-primary" strokeWidth={2} aria-hidden />
              )}
            </div>
          )}
          {segment === "transfer" ? null : (
            <>
              <p className="text-base font-bold text-primary">{emptyTitle}</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">{emptySubtitle}</p>
            </>
          )}
          {segment === "txns" ? (
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row">
              <Button
                type="button"
                className="h-11 rounded-xl px-8 text-base font-semibold"
                onClick={() => openTxModalWithType("expense")}
              >
                Add Transaction
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-xl px-8 text-base font-semibold"
                onClick={() => openTxModalWithType("transfer")}
              >
                Add Transfer
              </Button>
            </div>
          ) : segment === "expenses" ? (
            <Button
              type="button"
              className="mt-6 h-11 rounded-xl px-8 text-base font-semibold"
              onClick={() => setExpenseModalOpen(true)}
            >
              Add Expense
            </Button>
          ) : segment === "transfer" ? (
            <Button
              type="button"
              className="h-11 rounded-xl px-10 text-base font-semibold"
              onClick={() => openTxModalWithType("transfer")}
            >
              Add Transfer
            </Button>
          ) : segment === "udhar" ? (
            <Button
              type="button"
              className="mt-6 h-11 rounded-xl px-8 text-base font-semibold"
              onClick={() => setUdharSheetOpen(true)}
            >
              Add Udhar Entry
            </Button>
          ) : null}
        </div>
      )}

      {!isLoading &&
        !isError &&
        entriesHasList &&
        (segment === "txns" || segment === "expenses") && (
          <ul className="flex list-none flex-col gap-3" aria-label="Entries list">
            {filtered.map((tx) => (
              <li key={tx.id}>
                <RecentTransactionRow
                  tx={tx}
                  accounts={accounts}
                  onDelete={txDelete.requestDelete}
                />
              </li>
            ))}
          </ul>
        )}

      {!isLoading && !isError && entriesHasList && segment === "udhar" && (
        <ul className="flex list-none flex-col gap-2.5" aria-label="Udhar list">
          {udharTransactions.map((tx) => (
            <li key={tx.id}>
              <UdharEntryRow
                personName={inferUdharPersonName(tx)}
                amountInr={Math.abs(parseSignedAmountString(tx.signedAmount))}
                direction={udharDirectionLabel(tx)}
                onClick={() => setSelectedUdharTx(tx)}
                onDelete={() => txDelete.requestDelete(tx)}
              />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && !isError && entriesHasList && segment === "transfer" && (
        <ul className="flex list-none flex-col gap-3" aria-label="Transfers list">
          {filtered.map((tx) => (
            <li key={tx.id}>
              <TransferTransactionRow
                tx={tx}
                accounts={accounts}
                onDelete={txDelete.requestDelete}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
