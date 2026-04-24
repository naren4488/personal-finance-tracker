import { useMemo } from "react"
import { TransactionBottomTag } from "@/features/entries/emi-transaction-bottom-tag"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import {
  buildTransactionBottomLabel,
  buildRecentTxPrimaryTitle,
  buildRecentTxSubtitleParts,
} from "@/features/entries/transaction-list-utils"
import type { Account } from "@/lib/api/account-schemas"
import { aggregateUdharLedgerQuadrantTotals } from "@/lib/udhar/udhar-totals"
import { getUdharLedgerRowHeading } from "@/lib/udhar/udhar-entry-labels"
import { getUdharEffect, udharEffectTextClassName } from "@/lib/udhar/udhar-effect"
import {
  getRecentTransactionCategoryLabel,
  inferUdharPersonName,
  parseSignedAmountString,
  sanitizeUserFacingApiText,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import { ACTION_GROUP_ROW } from "@/lib/ui/action-group-classes"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

const quadrantTile = "rounded-2xl border border-border bg-card p-3 shadow-sm"

/** Matches People list: positive → you receive; negative → you pay. */
function netListCaption(signed: number): string {
  if (signed > 0) return "You will get"
  if (signed < 0) return "You will give"
  return "Settled"
}

function netHeadlineTextClassName(signed: number): string {
  if (signed > 0) return "text-emerald-600 dark:text-emerald-400"
  if (signed < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

export function PersonUdharNetAndQuadrants({
  entries,
  listTotalBalance,
}: {
  entries: RecentTransaction[]
  /**
   * Signed net from `GET /people` (`person.totalBalance`) when set so the headline matches the People list.
   * Omitted/undefined: derived only from the ledger (same as before).
   */
  listTotalBalance?: number
}) {
  const totals = useMemo(() => aggregateUdharLedgerQuadrantTotals(entries), [entries])
  const signed = listTotalBalance !== undefined ? listTotalBalance : totals.net
  const netDisplay = formatCurrency(Math.abs(signed))

  return (
    <>
      <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm">
        <p className="text-xs font-medium text-muted-foreground">Net Balance</p>
        <p
          className={cn(
            "mt-1 text-3xl font-bold tabular-nums tracking-tight",
            netHeadlineTextClassName(signed)
          )}
        >
          {netDisplay}
        </p>
        <p className={cn("mt-1 text-xs", netHeadlineTextClassName(signed))}>
          {netListCaption(signed)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
        <div className={quadrantTile}>
          <p className="text-xs text-muted-foreground">Money Given</p>
          <p className="mt-1 text-base font-bold tabular-nums text-income">
            {formatCurrency(totals.given)}
          </p>
        </div>
        <div className={quadrantTile}>
          <p className="text-xs text-muted-foreground">Money Taken</p>
          <p className="mt-1 text-base font-bold tabular-nums text-destructive">
            {formatCurrency(totals.taken)}
          </p>
        </div>
        <div className={quadrantTile}>
          <p className="text-xs text-muted-foreground">Payment Received</p>
          <p className="mt-1 text-base font-bold tabular-nums text-foreground">
            {formatCurrency(totals.receivedBack)}
          </p>
        </div>
        <div className={quadrantTile}>
          <p className="text-xs text-muted-foreground">Payment Made</p>
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
  accounts,
}: {
  entries: RecentTransaction[]
  onDeleteEntry?: (tx: RecentTransaction) => void
  /** e.g. modal: min-h-0 flex-1 overflow-y-auto overscroll-contain … */
  listClassName?: string
  /** When provided, subtitle shows person + resolved account names (same as Entries). */
  accounts?: Account[]
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
        const personName = inferUdharPersonName(tx)
        const category = getRecentTransactionCategoryLabel(tx)
        const categoryDisplay =
          typeof category === "string"
            ? category
                .trim()
                .replace(/[_-]+/g, " ")
                .replace(/\s+/g, " ")
                .replace(/\b\w/g, (m) => m.toUpperCase())
            : ""
        const onBehalfHeading =
          tx.type === "expense" && paidOnBehalf && personName && personName !== "Unknown"
            ? `${categoryDisplay || "Expense"} on behalf of ${personName}`
            : ""
        const showCategoryUnderHeading =
          tx.type === "expense" &&
          paidOnBehalf &&
          typeof category === "string" &&
          category.trim().length > 0
        const canDelete = Boolean(onDeleteEntry && String(tx.id ?? "").trim())
        const subParts =
          accounts && accounts.length > 0
            ? buildRecentTxSubtitleParts(tx, accounts, { includeDate: false })
            : null
        const ledgerFallback = !subParts ? sanitizeUserFacingApiText(tx.subtitle) : ""
        const bottomLabel = buildTransactionBottomLabel(tx, accounts ?? [])
        const primaryTitle = onBehalfHeading || buildRecentTxPrimaryTitle(tx)
        return (
          <li
            key={tx.id}
            className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card"
          >
            <div className="p-3.5">
              <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
              <div className="mt-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    <span className="text-muted-foreground">{heading.arrow} </span>
                    {primaryTitle}
                  </p>
                  {showCategoryUnderHeading && !onBehalfHeading ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{category}</p>
                  ) : null}
                  {subParts?.line1 ? (
                    <p className="mt-1 text-xs text-muted-foreground">{subParts.line1}</p>
                  ) : null}
                  {subParts?.line2 ? (
                    <p className="mt-0.5 wrap-break-word text-xs text-muted-foreground">
                      {subParts.line2}
                    </p>
                  ) : null}
                  {ledgerFallback ? (
                    <p className="mt-1 text-xs text-muted-foreground">{ledgerFallback}</p>
                  ) : null}
                </div>
                <div className={cn(ACTION_GROUP_ROW, "shrink-0 self-start")}>
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
            </div>
            <TransactionBottomTag label={bottomLabel} className="px-3.5" />
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
