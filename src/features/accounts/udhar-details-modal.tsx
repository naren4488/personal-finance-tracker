import { useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import { aggregateUdharLedgerEntries } from "@/lib/udhar/udhar-totals"
import {
  inferUdharPersonName,
  parseSignedAmountString,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import { ACTION_GROUP_ROW } from "@/lib/ui/action-group-classes"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export function UdharDetailsModal({
  open,
  onOpenChange,
  personName,
  entries,
  onDeleteEntry,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personName: string
  entries: RecentTransaction[]
  onDeleteEntry?: (tx: RecentTransaction) => void
}) {
  const totals = useMemo(() => {
    const { totalLent, totalBorrowed, net } = aggregateUdharLedgerEntries(entries)
    return { given: totalLent, taken: totalBorrowed, net }
  }, [entries])

  const netStr = formatCurrency(Math.abs(totals.net))

  const headline = useMemo(() => {
    if (totals.net > 0) return `Net receivable ${netStr}.`
    if (totals.net < 0) return `Net payable ${netStr}.`
    return "There is no net balance with this person."
  }, [totals.net, netStr])

  const netTileLabel = useMemo(() => {
    if (totals.net === 0) return formatCurrency(0)
    if (totals.net > 0) return `Receivable ${netStr}`
    return `Payable ${netStr}`
  }, [totals.net, netStr])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        onClick={() => onOpenChange(false)}
        aria-label="Close details"
      />
      <div className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border bg-card p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground">{personName}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{headline}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            onClick={() => onOpenChange(false)}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">Receivable (+signed)</p>
            <p className="text-base font-bold text-income">{formatCurrency(totals.given)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">Payable (−signed)</p>
            <p className="text-base font-bold text-destructive">{formatCurrency(totals.taken)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">Net</p>
            <p
              className={
                totals.net === 0
                  ? "text-base font-bold text-muted-foreground"
                  : totals.net > 0
                    ? "text-base font-bold text-income"
                    : "text-base font-bold text-destructive"
              }
            >
              {netTileLabel}
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {entries.map((tx) => {
            const signed = parseSignedAmountString(tx.signedAmount)
            const absAmt = Math.abs(signed)
            const amountLabel =
              signed > 0
                ? `Receivable ${formatCurrency(absAmt)}`
                : signed < 0
                  ? `Payable ${formatCurrency(absAmt)}`
                  : formatCurrency(0)
            const canDelete = Boolean(onDeleteEntry && String(tx.id ?? "").trim())

            return (
              <li key={tx.id} className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate font-semibold text-foreground">
                    {inferUdharPersonName(tx)}
                  </p>
                  <div className={cn(ACTION_GROUP_ROW, "shrink-0")}>
                    {canDelete ? (
                      <TransactionEntryDeleteButton onClick={() => onDeleteEntry?.(tx)} />
                    ) : null}
                    <p
                      className={
                        signed > 0
                          ? "text-right font-bold tabular-nums text-income"
                          : signed < 0
                            ? "text-right font-bold tabular-nums text-destructive"
                            : "text-right font-bold tabular-nums text-muted-foreground"
                      }
                    >
                      {amountLabel}
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
      </div>
    </div>
  )
}
