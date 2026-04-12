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
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { getErrorMessage } from "@/lib/api/errors"
import type { TransactionType } from "@/lib/api/schemas"
import type { RecentTransactionsQueryArg } from "@/store/api/base-api"
import {
  inferUdharPersonName,
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
type TimePreset = "7d" | "month" | "3m" | "year" | "all" | "custom"

const SEARCH_DEBOUNCE_MS = 400

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
  { id: "custom", label: "Custom" },
]

const LIMIT_OPTIONS = [50, 100, 200, 400, 1000] as const

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Backend example: `1-04-2026` (day-month-year). */
function formatApiDmyFromLocalDay(d: Date): string {
  const day = d.getDate()
  const month = d.getMonth() + 1
  const y = d.getFullYear()
  return `${day}-${String(month).padStart(2, "0")}-${y}`
}

function dateRangeForPreset(
  preset: Exclude<TimePreset, "custom">,
  now: Date
): {
  fromDate?: string
  toDate?: string
} {
  const today = startOfLocalDay(now)
  const toDate = formatApiDmyFromLocalDay(today)
  if (preset === "all") return {}
  if (preset === "7d") {
    const start = new Date(today)
    start.setDate(start.getDate() - 6)
    return { fromDate: formatApiDmyFromLocalDay(start), toDate }
  }
  if (preset === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1)
    return { fromDate: formatApiDmyFromLocalDay(start), toDate }
  }
  if (preset === "3m") {
    const start = new Date(today)
    start.setMonth(start.getMonth() - 3)
    return { fromDate: formatApiDmyFromLocalDay(start), toDate }
  }
  if (preset === "year") {
    const start = new Date(today.getFullYear(), 0, 1)
    return { fromDate: formatApiDmyFromLocalDay(start), toDate }
  }
  return {}
}

function isoDateInputToApiDmy(iso: string): string | undefined {
  const t = iso.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return undefined
  const [y, m, d] = t.split("-").map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined
  return formatApiDmyFromLocalDay(new Date(y, m - 1, d))
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
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [txModalInitialType, setTxModalInitialType] = useState<TransactionType>("expense")
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [udharSheetOpen, setUdharSheetOpen] = useState(false)
  const [addAccountSheetOpen, setAddAccountSheetOpen] = useState(false)
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | TransactionType>("all")
  const [directionFilter, setDirectionFilter] = useState<"all" | "debit" | "credit">("all")
  const [listLimit, setListLimit] = useState<number>(200)
  const [customRangeFrom, setCustomRangeFrom] = useState("")
  const [customRangeTo, setCustomRangeTo] = useState("")
  const [selectedUdharTx, setSelectedUdharTx] = useState<RecentTransaction | null>(null)
  const txDelete = useDeleteTransactionFlow()

  const user = useAppSelector((s) => s.auth.user)

  const recentQueryArg = useMemo((): RecentTransactionsQueryArg => {
    const arg: RecentTransactionsQueryArg = { limit: listLimit }

    const q = debouncedSearch.trim()
    if (q) arg.search = q

    if (segment === "expenses") arg.type = "expense"
    else if (segment === "transfer") arg.type = "transfer"
    else if (segment === "txns" && txTypeFilter !== "all") arg.type = txTypeFilter

    if (directionFilter !== "all") arg.direction = directionFilter

    if (timePreset === "custom") {
      const from = customRangeFrom ? isoDateInputToApiDmy(customRangeFrom) : undefined
      const to = customRangeTo ? isoDateInputToApiDmy(customRangeTo) : undefined
      if (from) arg.fromDate = from
      if (to) arg.toDate = to
    } else {
      const r = dateRangeForPreset(timePreset as Exclude<TimePreset, "custom">, new Date())
      if (r.fromDate) arg.fromDate = r.fromDate
      if (r.toDate) arg.toDate = r.toDate
    }

    return arg
  }, [
    listLimit,
    debouncedSearch,
    segment,
    txTypeFilter,
    directionFilter,
    timePreset,
    customRangeFrom,
    customRangeTo,
  ])

  const customRangeIncomplete =
    timePreset === "custom" && (!customRangeFrom.trim() || !customRangeTo.trim())

  const {
    data: recentTransactions = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetRecentTransactionsQuery(recentQueryArg, {
    skip: !user || customRangeIncomplete,
  })

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

  const sortedServerList = useMemo(
    () => [...recentTransactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [recentTransactions]
  )

  const displayList: RecentTransaction[] =
    segment === "udhar" ? udharTransactions : sortedServerList

  const entriesHasList = useMemo(() => {
    if (customRangeIncomplete) return false
    if (segment === "udhar") {
      return !isLoading && !isError && udharTransactions.length > 0
    }
    return !isLoading && !isError && sortedServerList.length > 0
  }, [
    customRangeIncomplete,
    segment,
    isLoading,
    isError,
    udharTransactions.length,
    sortedServerList.length,
  ])

  const totalDisplay = headerTotalLabel(segment, displayList)

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
  const showTimeAndSearch = true
  const searchPlaceholder =
    segment === "expenses"
      ? "Search expenses…"
      : segment === "txns"
        ? "Search transactions…"
        : segment === "transfer"
          ? "Search transfers…"
          : "Search entries…"

  const showEmptyNoResults = !customRangeIncomplete && !isLoading && !isError && !entriesHasList

  const updating = isFetching && !isLoading

  return (
    <main
      className={cn(
        "min-h-0 flex-1 bg-background px-4 py-4 pb-28 transition-opacity",
        updating && "opacity-[0.98]"
      )}
    >
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
          {showHeaderTotal && !isLoading && !isError && !customRangeIncomplete ? (
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
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium text-muted-foreground">Limit</span>
            <select
              value={listLimit}
              onChange={(e) => setListLimit(Number(e.target.value))}
              className="h-9 rounded-full border border-border/80 bg-muted/70 px-3 pr-8 text-xs font-semibold outline-none"
              aria-label="Max transactions to load"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

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

          {timePreset === "custom" && (
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <span className="text-[10px] font-medium text-muted-foreground">From</span>
                <Input
                  type="date"
                  value={customRangeFrom}
                  onChange={(e) => setCustomRangeFrom(e.target.value)}
                  className="h-10 w-[11rem] rounded-xl"
                />
              </div>
              <div className="grid gap-1">
                <span className="text-[10px] font-medium text-muted-foreground">To</span>
                <Input
                  type="date"
                  value={customRangeTo}
                  onChange={(e) => setCustomRangeTo(e.target.value)}
                  className="h-10 w-[11rem] rounded-xl"
                />
              </div>
            </div>
          )}

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
              <div className="relative min-w-0 flex-1 sm:max-w-[11rem]">
                <select
                  value={directionFilter}
                  onChange={(e) => setDirectionFilter(e.target.value as "all" | "debit" | "credit")}
                  className="h-10 w-full appearance-none rounded-full border border-border/80 bg-muted/70 px-3.5 pr-9 text-xs font-semibold text-foreground outline-none"
                  aria-label="Filter by direction"
                >
                  <option value="all">All directions</option>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
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
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-11 rounded-xl border-border/80 bg-muted/40 pl-10"
              autoComplete="off"
            />
          </div>
        </>
      )}

      {customRangeIncomplete && (
        <p className="mb-4 text-sm text-muted-foreground">
          Select both start and end dates for the custom range.
        </p>
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

      {isLoading && !isError && !customRangeIncomplete && (
        <div className="space-y-2">
          <Skeleton className="h-18 w-full rounded-2xl" />
          <Skeleton className="h-18 w-full rounded-2xl" />
          <Skeleton className="h-18 w-full rounded-2xl" />
        </div>
      )}

      {showEmptyNoResults && (
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
              <p className="text-base font-bold text-primary">No transactions found</p>
              <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                {segment === "udhar"
                  ? "No udhar entries in this range. Add an udhar entry to track money given or taken."
                  : "Try adjusting filters or date range."}
              </p>
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
            {displayList.map((tx) => (
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
          {displayList.map((tx) => (
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
          {displayList.map((tx) => (
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
