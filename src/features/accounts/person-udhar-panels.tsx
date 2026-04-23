import { useMemo } from "react"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import { aggregateUdharLedgerQuadrantTotals } from "@/lib/udhar/udhar-totals"
import { getUdharLedgerRowHeading } from "@/lib/udhar/udhar-entry-labels"
import { getUdharEffect, udharEffectTextClassName } from "@/lib/udhar/udhar-effect"
import {
  getRecentTransactionCategoryLabel,
  parseSignedAmountString,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import { ACTION_GROUP_ROW } from "@/lib/ui/action-group-classes"
import { formatCurrency, formatDate, formatSignedCurrencyInr } from "@/lib/format"
import { cn } from "@/lib/utils"

const quadrantTile = "rounded-2xl border border-border bg-card p-3 shadow-sm"

function netSubtitle(net: number): string {
  if (net > 0) return "They owe you"
  if (net < 0) return "You owe them"
  return "All settled"
}

export function PersonUdharNetAndQuadrants({ entries }: { entries: RecentTransaction[] }) {
  const totals = useMemo(() => aggregateUdharLedgerQuadrantTotals(entries), [entries])

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">Net Balance</p>
        <p
          className={cn(
            "mt-1 text-3xl font-bold tabular-nums tracking-tight",
            totals.net > 0 && "text-income",
            totals.net < 0 && "text-destructive",
            totals.net === 0 && "text-muted-foreground"
          )}
        >
          {formatSignedCurrencyInr(totals.net)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{netSubtitle(totals.net)}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        <div className={quadrantTile}>
          <p className="text-xs text-muted-foreground">Given</p>
          <p className="mt-1 text-base font-bold tabular-nums text-income">
            {formatCurrency(totals.given)}
          </p>
        </div>
        <div className={quadrantTile}>
          <p className="text-xs text-muted-foreground">Taken</p>
          <p className="mt-1 text-base font-bold tabular-nums text-destructive">
            {formatCurrency(totals.taken)}
          </p>
        </div>
        <div className={quadrantTile}>
          <p className="text-xs text-muted-foreground">Received Back</p>
          <p className="mt-1 text-base font-bold tabular-nums text-foreground">
            {formatCurrency(totals.receivedBack)}
          </p>
        </div>
        <div className={quadrantTile}>
          <p className="text-xs text-muted-foreground">Paid Back</p>
          <p className="mt-1 text-base font-bold tabular-nums text-foreground">
            {formatCurrency(totals.paidBack)}
          </p>
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
}) {
  return (
    <ul className={cn("space-y-2 pr-0.5", listClassName)}>
      {entries.map((tx) => {
        const effect = getUdharEffect(tx)
        const absAmt = Math.abs(parseSignedAmountString(tx.signedAmount))
        const heading = getUdharLedgerRowHeading(tx)
        const rec = tx as unknown as Record<string, unknown>
        const personId = typeof rec.personId === "string" ? rec.personId.trim() : ""
        const paidOnBehalf = rec.paidOnBehalf === true || Boolean(personId)
        const category = getRecentTransactionCategoryLabel(tx)
        const showCategoryUnderHeading =
          tx.type === "expense" &&
          paidOnBehalf &&
          typeof category === "string" &&
          category.trim().length > 0
        const canDelete = Boolean(onDeleteEntry && String(tx.id ?? "").trim())
        return (
          <li key={tx.id} className="rounded-2xl border border-border/80 bg-card p-3.5">
            <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  <span className="text-muted-foreground">{heading.arrow} </span>
                  {heading.label}
                </p>
                {showCategoryUnderHeading ? (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{category}</p>
                ) : null}
              </div>
              <div className={cn(ACTION_GROUP_ROW, "shrink-0")}>
                {canDelete ? (
                  <TransactionEntryDeleteButton onClick={() => onDeleteEntry?.(tx)} />
                ) : null}
                <p
                  className={cn(
                    "text-right text-base font-bold tabular-nums",
                    absAmt === 0 ? "text-muted-foreground" : udharEffectTextClassName(effect)
                  )}
                >
                  {formatCurrency(absAmt)}
                </p>
              </div>
            </div>
            {tx.subtitle?.trim() ? (
              <p className="mt-1 text-xs text-muted-foreground">{tx.subtitle}</p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

export function PersonUdharAvatarTitle({ personName }: { personName: string }) {
  const initial = (personName.trim().charAt(0) || "?").toUpperCase()
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-bold text-primary"
        aria-hidden
      >
        {initial}
      </div>
      <h2 className="truncate text-xl font-bold text-foreground">{personName}</h2>
    </div>
  )
}
