import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import { formatCurrency, formatDate } from "@/lib/format"
import { ACTION_GROUP_ROW } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

export function UdharEntryRow({
  date,
  personName,
  signedAmountInr,
  entryCount,
  statusLabel,
  onClick,
  onDelete,
}: {
  /** Transaction date (ISO or display string from API). */
  date: string
  personName: string
  /** Backend `signedAmount` as number: &gt;0 = receivable (green), &lt;0 = payable (red). */
  signedAmountInr: number
  entryCount?: number
  statusLabel?: string
  onClick?: () => void
  /** Separate from row navigation — uses pill Delete like other entry lists. */
  onDelete?: () => void
}) {
  const abs = Math.abs(signedAmountInr)
  const amountColor =
    signedAmountInr > 0
      ? "text-income"
      : signedAmountInr < 0
        ? "text-destructive"
        : "text-muted-foreground"
  const sign = signedAmountInr > 0 ? "+" : signedAmountInr < 0 ? "−" : ""
  const showDelete = Boolean(onDelete)

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3.5 shadow-sm",
        onClick && "transition-colors hover:bg-muted/40"
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 flex-col items-stretch gap-1 text-left outline-none",
          onClick && "rounded-xl active:bg-muted/60"
        )}
        onClick={onClick}
      >
        <p className="text-xs leading-snug text-muted-foreground">{formatDate(date)}</p>
        <p className="truncate text-[15px] font-bold leading-tight text-foreground">{personName}</p>
        {typeof entryCount === "number" ? (
          <p className="text-xs text-muted-foreground">
            {entryCount} {entryCount === 1 ? "entry" : "entries"}
          </p>
        ) : null}
      </button>
      <div className={cn(ACTION_GROUP_ROW, "shrink-0")}>
        {showDelete ? <TransactionEntryDeleteButton onClick={() => onDelete?.()} /> : null}
        <div className="text-right">
          <p className={cn("text-base font-bold tabular-nums tracking-tight", amountColor)}>
            {signedAmountInr === 0 ? formatCurrency(0) : `${sign}${formatCurrency(abs)}`}
          </p>
          {statusLabel ? <p className="text-sm text-muted-foreground">{statusLabel}</p> : null}
        </div>
      </div>
    </div>
  )
}
