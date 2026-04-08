import { useMemo } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { parseSignedAmountString, udharDirectionLabel } from "@/lib/api/transaction-schemas"
import { formatCurrency, formatDate } from "@/lib/format"

export function UdharDetailsModal({
  open,
  onOpenChange,
  personName,
  entries,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  personName: string
  entries: RecentTransaction[]
}) {
  const totals = useMemo(() => {
    let given = 0
    let taken = 0
    for (const tx of entries) {
      const amt = Math.abs(parseSignedAmountString(tx.signedAmount))
      const dir = udharDirectionLabel(tx)
      if (dir === "given") given += amt
      else taken += amt
    }
    return { given, taken, net: given - taken }
  }, [entries])

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
            <p className="text-sm text-muted-foreground">Full ledger details</p>
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
            <p className="text-xs text-muted-foreground">Given</p>
            <p className="text-base font-bold text-income">{formatCurrency(totals.given)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">Taken</p>
            <p className="text-base font-bold text-destructive">{formatCurrency(totals.taken)}</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">Net</p>
            <p
              className={
                totals.net >= 0
                  ? "text-base font-bold text-income"
                  : "text-base font-bold text-destructive"
              }
            >
              {`${totals.net >= 0 ? "+" : "-"}${formatCurrency(Math.abs(totals.net))}`}
            </p>
          </div>
        </div>

        <ul className="space-y-2">
          {entries.map((tx) => {
            const rec = tx as unknown as Record<string, unknown>
            const direction = udharDirectionLabel(tx)
            const amount = Math.abs(parseSignedAmountString(tx.signedAmount))
            return (
              <li key={tx.id} className="rounded-xl border border-border/70 bg-card p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground">{tx.title}</p>
                  <p
                    className={
                      direction === "given" ? "font-bold text-income" : "font-bold text-destructive"
                    }
                  >
                    {`${direction === "given" ? "+" : "-"}${formatCurrency(amount)}`}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(tx.date)}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>direction: {direction}</span>
                  <span>type: {tx.type}</span>
                  {typeof rec.personId === "string" ? <span>personId: {rec.personId}</span> : null}
                  {typeof tx.accountId === "string" ? <span>accountId: {tx.accountId}</span> : null}
                  {typeof tx.sourceName === "string" ? <span>source: {tx.sourceName}</span> : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
