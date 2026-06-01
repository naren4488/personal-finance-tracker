import { TransactionListRow } from "@/features/entries/transaction-list-row"
import type { Account } from "@/lib/api/account-schemas"
import type { PersonUdharTotals } from "@/lib/api/people-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { formatCurrency } from "@/lib/format"
import {
  personNetAmountClassName,
  personNetBalanceLine,
  personNetListCaption,
  personNetTextClassName,
} from "@/lib/people/person-balance-display"
import { cn } from "@/lib/utils"

const summaryTile = "rounded-2xl border border-border bg-card p-3 shadow-sm"

export function PersonUdharNetAndQuadrants({ apiTotals }: { apiTotals: PersonUdharTotals }) {
  const signed = apiTotals.totalBalance
  const netDisplay = formatCurrency(Math.abs(signed))

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">Net Balance</p>
        <p
          className={cn(
            "mt-1 text-3xl font-bold tabular-nums tracking-tight",
            personNetTextClassName(signed)
          )}
        >
          {netDisplay}
        </p>
        <p className={cn("mt-1 text-xs", personNetTextClassName(signed))}>
          {personNetListCaption(signed)}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Summary</p>
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          <div className={summaryTile}>
            <p className="text-xs text-muted-foreground">Total Given</p>
            <p className="mt-1 text-base font-bold tabular-nums text-income">
              {formatCurrency(apiTotals.totalGiven)}
            </p>
          </div>
          <div className={summaryTile}>
            <p className="text-xs text-muted-foreground">Total Taken</p>
            <p className="mt-1 text-base font-bold tabular-nums text-destructive">
              {formatCurrency(apiTotals.totalTaken)}
            </p>
          </div>
          <div className={summaryTile}>
            <p className="text-xs text-muted-foreground">Total Received</p>
            <p className="mt-1 text-base font-bold tabular-nums text-foreground">
              {formatCurrency(apiTotals.totalReceived)}
            </p>
          </div>
          <div className={summaryTile}>
            <p className="text-xs text-muted-foreground">Total Paid</p>
            <p className="mt-1 text-base font-bold tabular-nums text-foreground">
              {formatCurrency(apiTotals.totalPaid)}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}

export function PersonUdharLedgerList({
  entries,
  onDeleteEntry,
  listClassName,
}: {
  entries: RecentTransaction[]
  onDeleteEntry?: (tx: RecentTransaction) => void
  /** e.g. modal: min-h-0 flex-1 overflow-y-auto overscroll-contain … */
  listClassName?: string
  /** @deprecated Not used for display; API fields on each transaction row are used instead. */
  accounts?: Account[]
}) {
  return (
    <ul className={cn("space-y-2 pr-0.5", listClassName)}>
      {entries.map((tx) => (
        <li key={tx.id}>
          <TransactionListRow tx={tx} onDelete={onDeleteEntry} amountStyle="udhar-ledger" />
        </li>
      ))}
    </ul>
  )
}

export function PersonUdharAvatarTitle({
  personName,
  apiTotalBalance,
}: {
  personName: string
  /** Signed `person.totalBalance` from GET /people — matches People list. */
  apiTotalBalance: number
}) {
  const initial = (personName.trim().charAt(0) || "?").toUpperCase()
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-bold text-primary"
        aria-hidden
      >
        {initial}
      </div>
      <div className="min-w-0">
        <h2 className="truncate text-xl font-bold text-foreground">{personName}</h2>
        <p className={cn("mt-0.5 text-sm", personNetAmountClassName(apiTotalBalance))}>
          {personNetBalanceLine(apiTotalBalance)}
        </p>
      </div>
    </div>
  )
}
