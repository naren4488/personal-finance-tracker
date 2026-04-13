import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
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
  isUdharRecentTransaction,
  parseSignedAmountString,
  resolveUdharPersonDisplayName,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  useGetAccountsQuery,
  useGetCommitmentsQuery,
  useGetRecentTransactionsQuery,
} from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"
import {
  ENTRIES_ADD_SEARCH_PARAM,
  ENTRIES_FAB_OPEN_EVENT,
  ENTRIES_LAST_SEGMENT_KEY,
  type EntryAddQueryValue,
} from "@/features/entries/entries-fab"

type EntrySegment = "txns" | "expenses" | "udhar" | "transfer"

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

/**
 * Rolling window: `toDate` = today (local), `fromDate` = today − N calendar days.
 * "Today" = N = 0 → same calendar day for both (API: YYYY-MM-DD).
 */
const DAY_WINDOW_CHIPS: { days: number; label: string }[] = [
  { days: 0, label: "Today" },
  { days: 3, label: "3d" },
  { days: 7, label: "7d" },
  { days: 15, label: "15d" },
]

/** Fixed list size for GET /transactions/recent (limit control removed from UI). */
const ENTRIES_RECENT_DEFAULT_LIMIT = 200

/** "All" range: `fromDate` fixed far past, `toDate` = today — still valid YYYY-MM-DD pair for API. */
const ALL_DAYS_FROM = "2000-01-01"

function startOfLocalDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Backend accepts YYYY-MM-DD (or DD/MM/YYYY); we use ISO-like local YYYY-MM-DD. */
function formatYyyyMmDd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * `toDate` = today (local); `fromDate` = today minus `daysBack` calendar days (both YYYY-MM-DD).
 * `daysBack === 0` → Today only (fromDate === toDate).
 */
function dateRangeRollingDaysFromToday(
  daysBack: number,
  now: Date = new Date()
): {
  fromDate: string
  toDate: string
} {
  const end = startOfLocalDay(now)
  const start = new Date(end)
  start.setDate(start.getDate() - daysBack)
  return { fromDate: formatYyyyMmDd(start), toDate: formatYyyyMmDd(end) }
}

function dateRangeAllDaysThroughToday(now: Date = new Date()): {
  fromDate: string
  toDate: string
} {
  return { fromDate: ALL_DAYS_FROM, toDate: formatYyyyMmDd(startOfLocalDay(now)) }
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
  const [searchParams, setSearchParams] = useSearchParams()
  const addQuery = searchParams.get(ENTRIES_ADD_SEARCH_PARAM)

  const [segment, setSegment] = useState<EntrySegment>("txns")
  /** Days to look back from today (`fromDate`); 0 = today only. Ignored when `useAllDaysRange`. */
  const [dayWindowDays, setDayWindowDays] = useState(7)
  /** If true, request full history from `ALL_DAYS_FROM` through today. */
  const [useAllDaysRange, setUseAllDaysRange] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS)
  const [txModalOpen, setTxModalOpen] = useState(false)
  const [txModalInitialType, setTxModalInitialType] = useState<TransactionType>("expense")
  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [udharSheetOpen, setUdharSheetOpen] = useState(false)
  const [addAccountSheetOpen, setAddAccountSheetOpen] = useState(false)
  const [txTypeFilter, setTxTypeFilter] = useState<"all" | TransactionType>("all")
  const [directionFilter, setDirectionFilter] = useState<"all" | "debit" | "credit">("all")
  const [selectedUdharTx, setSelectedUdharTx] = useState<RecentTransaction | null>(null)
  const txDelete = useDeleteTransactionFlow()

  const user = useAppSelector((s) => s.auth.user)

  const recentQueryArg = useMemo((): RecentTransactionsQueryArg => {
    const arg: RecentTransactionsQueryArg = { limit: ENTRIES_RECENT_DEFAULT_LIMIT }

    const q = debouncedSearch.trim()
    if (q) arg.search = q

    if (segment === "expenses") arg.type = "expense"
    else if (segment === "transfer") arg.type = "transfer"
    else if (segment === "txns" && txTypeFilter !== "all") arg.type = txTypeFilter

    if (directionFilter !== "all") arg.direction = directionFilter

    const range = useAllDaysRange
      ? dateRangeAllDaysThroughToday(new Date())
      : dateRangeRollingDaysFromToday(dayWindowDays, new Date())
    arg.fromDate = range.fromDate
    arg.toDate = range.toDate

    return arg
  }, [debouncedSearch, segment, txTypeFilter, directionFilter, dayWindowDays, useAllDaysRange])

  const {
    data: recentTransactions = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetRecentTransactionsQuery(recentQueryArg, {
    skip: !user,
  })

  const {
    data: accounts = [],
    isError: accountsQueryError,
    error: accountsError,
  } = useGetAccountsQuery(undefined, { skip: !user })

  const { data: commitments = [] } = useGetCommitmentsQuery(undefined, {
    skip: !user,
  })

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

  useEffect(() => {
    try {
      sessionStorage.setItem(ENTRIES_LAST_SEGMENT_KEY, segment)
    } catch {
      /* ignore */
    }
  }, [segment])

  const openEntriesHeaderAdd = useCallback(() => {
    if (segment === "txns") {
      const initial: TransactionType = txTypeFilter !== "all" ? txTypeFilter : "expense"
      setTxModalInitialType(initial)
      setTxModalOpen(true)
      return
    }
    if (segment === "expenses") {
      setExpenseModalOpen(true)
      return
    }
    if (segment === "transfer") {
      setTxModalInitialType("transfer")
      setTxModalOpen(true)
      return
    }
    if (segment === "udhar") {
      setUdharSheetOpen(true)
    }
  }, [segment, txTypeFilter])

  const openEntriesHeaderAddRef = useRef(openEntriesHeaderAdd)
  useEffect(() => {
    openEntriesHeaderAddRef.current = openEntriesHeaderAdd
  }, [openEntriesHeaderAdd])

  useEffect(() => {
    const onFab = () => {
      openEntriesHeaderAddRef.current()
    }
    window.addEventListener(ENTRIES_FAB_OPEN_EVENT, onFab)
    return () => window.removeEventListener(ENTRIES_FAB_OPEN_EVENT, onFab)
  }, [])

  /** Deep link / Home FAB: `?add=txns|expenses|transfer|udhar` opens that flow once. */
  useEffect(() => {
    if (!user || !addQuery) return
    const valid: EntryAddQueryValue[] = ["txns", "expenses", "transfer", "udhar"]
    const seg = valid.find((v) => v === addQuery)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(ENTRIES_ADD_SEARCH_PARAM)
        return next
      },
      { replace: true }
    )
    if (!seg) return
    const id = window.setTimeout(() => {
      setSegment(seg as EntrySegment)
      if (seg === "txns") {
        setTxModalInitialType("expense")
        setTxModalOpen(true)
      } else if (seg === "expenses") {
        setExpenseModalOpen(true)
      } else if (seg === "transfer") {
        setTxModalInitialType("transfer")
        setTxModalOpen(true)
      } else {
        setUdharSheetOpen(true)
      }
    }, 0)
    return () => window.clearTimeout(id)
  }, [user, addQuery, setSearchParams])

  const udharTransactions = useMemo(
    () =>
      recentTransactions
        .filter(isUdharRecentTransaction)
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [recentTransactions]
  )

  const selectedUdharPersonEntries = useMemo(() => {
    if (!selectedUdharTx) return []
    const selectedName = resolveUdharPersonDisplayName(selectedUdharTx, commitments).toLowerCase()
    return udharTransactions.filter(
      (tx) => resolveUdharPersonDisplayName(tx, commitments).toLowerCase() === selectedName
    )
  }, [selectedUdharTx, udharTransactions, commitments])

  const sortedServerList = useMemo(
    () => [...recentTransactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [recentTransactions]
  )

  const displayList: RecentTransaction[] =
    segment === "udhar" ? udharTransactions : sortedServerList

  const entriesHasList = useMemo(() => {
    if (segment === "udhar") {
      return !isLoading && !isError && udharTransactions.length > 0
    }
    return !isLoading && !isError && sortedServerList.length > 0
  }, [segment, isLoading, isError, udharTransactions.length, sortedServerList.length])

  const totalDisplay = headerTotalLabel(segment, displayList)

  function openTxModalWithType(initial: TransactionType) {
    setTxModalInitialType(initial)
    setTxModalOpen(true)
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

  const showEmptyNoResults = !isLoading && !isError && !entriesHasList

  const updating = isFetching && !isLoading

  return (
    <main
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden bg-background px-4 py-4 pb-28 transition-opacity",
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
        personName={
          selectedUdharTx ? resolveUdharPersonDisplayName(selectedUdharTx, commitments) : ""
        }
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

      <div className="shrink-0 space-y-3">
        <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Entry categories">
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
                  "flex min-h-10 min-w-0 flex-row items-center justify-center gap-0.5 rounded-full px-1.5 py-1.5 text-center text-[10px] font-semibold leading-none transition-colors sm:min-h-11 sm:gap-1 sm:px-2 sm:text-xs",
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

        <div className="grid min-h-[2.75rem] grid-cols-1 items-center gap-x-3 gap-y-1 sm:grid-cols-[1fr_auto] sm:items-start">
          <h1 className="min-h-[1.75rem] min-w-0 text-lg font-bold leading-tight tracking-tight text-foreground sm:pt-0.5">
            {pageTitle}
          </h1>
          <div className="flex min-h-[1.75rem] flex-wrap items-center justify-start gap-x-3 gap-y-1 sm:justify-end">
            <div className="flex min-w-[5.5rem] items-center justify-end tabular-nums sm:min-w-[6rem]">
              {showHeaderTotal && !isLoading && !isError ? (
                <span className={totalDisplay.className}>{totalDisplay.text}</span>
              ) : showHeaderTotal && isLoading ? (
                <Skeleton className="h-6 w-16 rounded-md" />
              ) : (
                <span className="invisible text-lg font-bold tabular-nums" aria-hidden>
                  —
                </span>
              )}
            </div>
            {user ? (
              <Button
                type="button"
                variant="link"
                className="h-9 shrink-0 px-0 text-sm font-semibold text-primary"
                onClick={openEntriesHeaderAdd}
                aria-label={headerAddAriaLabel}
              >
                + Add
              </Button>
            ) : (
              <span className="inline-flex h-9 w-[3.25rem] shrink-0" aria-hidden />
            )}
          </div>
        </div>

        {showTimeAndSearch && (
          <>
            <div
              className="mb-3 flex flex-wrap items-center gap-2 sm:flex-nowrap sm:overflow-x-auto sm:pb-0.5"
              role="group"
              aria-label="Date range"
            >
              {DAY_WINDOW_CHIPS.map(({ days, label }) => {
                const active = !useAllDaysRange && dayWindowDays === days
                return (
                  <button
                    key={days}
                    type="button"
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => {
                      setUseAllDaysRange(false)
                      setDayWindowDays(days)
                    }}
                  >
                    {label}
                  </button>
                )
              })}
              <button
                type="button"
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  useAllDaysRange
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                onClick={() => setUseAllDaysRange(true)}
              >
                All
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                  Days
                </span>
                <Input
                  type="number"
                  min={0}
                  max={3650}
                  disabled={useAllDaysRange}
                  value={useAllDaysRange ? "" : dayWindowDays}
                  onChange={(e) => {
                    setUseAllDaysRange(false)
                    const raw = e.target.value
                    if (raw === "") return
                    const n = parseInt(raw, 10)
                    if (!Number.isFinite(n)) return
                    setDayWindowDays(Math.min(3650, Math.max(0, n)))
                  }}
                  className="h-9 w-16 rounded-lg px-2 text-center text-xs tabular-nums disabled:opacity-60"
                  aria-label="Custom number of days back from today"
                />
              </div>
            </div>

            <div className="mb-3 min-h-[2.75rem]">
              {segment === "txns" || segment === "expenses" || segment === "transfer" ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-stretch">
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
                      onChange={(e) =>
                        setDirectionFilter(e.target.value as "all" | "debit" | "credit")
                      }
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
              ) : null}
            </div>

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
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-gutter:stable] [scrollbar-width:thin]">
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
                  date={tx.date}
                  personName={resolveUdharPersonDisplayName(tx, commitments)}
                  signedAmountInr={parseSignedAmountString(tx.signedAmount)}
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
      </div>
    </main>
  )
}
