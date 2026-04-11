import { useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import { aggregateUdharLedgerEntries } from "@/lib/udhar/udhar-totals"
import {
  parseSignedAmountString,
  type RecentTransaction,
  udharDirectionLabel,
} from "@/lib/api/transaction-schemas"
import { formatCurrency, formatDate } from "@/lib/format"

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
    if (totals.net > 0) return `You will get ${netStr} from this person.`
    if (totals.net < 0) return `You owe ${netStr} to this person.`
    return "There is no net balance with this person."
  }, [totals.net, netStr])

  const netTileLabel = useMemo(() => {
    if (totals.net === 0) return formatCurrency(0)
    if (totals.net > 0) return `You lent ${netStr}`
    return `You borrow ${netStr}`
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
        <div className="mb-3 flex items-start justify-between gap-2">
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
            <p className="text-xs text-muted-foreground">Lent (given)</p>
            <p className="text-base font-bold text-income">{formatCurrency(totals.given)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">Borrowed (taken)</p>
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
            const direction = udharDirectionLabel(tx)
            const amount = Math.abs(parseSignedAmountString(tx.signedAmount))
            const amountLabel =
              direction === "given"
                ? `You lent ${formatCurrency(amount)}`
                : `You borrow ${formatCurrency(amount)}`
            const canDelete = Boolean(onDeleteEntry && String(tx.id ?? "").trim())

            return (
              <li key={tx.id} className="rounded-xl border border-border/70 bg-card p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 font-semibold text-foreground">{tx.title}</p>
                  <div className="flex shrink-0 items-center gap-2">
                    {canDelete ? (
                      <TransactionEntryDeleteButton onClick={() => onDeleteEntry?.(tx)} />
                    ) : null}
                    <p
                      className={
                        direction === "given"
                          ? "text-right font-bold text-income"
                          : "text-right font-bold text-destructive"
                      }
                    >
                      {amountLabel}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
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
