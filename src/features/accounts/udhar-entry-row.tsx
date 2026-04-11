import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

type UdharDirection = "given" | "taken"

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function UdharEntryRow({
  personName,
  amountInr,
  direction,
  entryCount,
  statusLabel,
  onClick,
  onDelete,
}: {
  personName: string
  amountInr: number
  direction: UdharDirection
  entryCount?: number
  statusLabel?: string
  onClick?: () => void
  /** Separate from row navigation — uses pill Delete like other entry lists. */
  onDelete?: () => void
}) {
  const amountColor = direction === "given" ? "text-income" : "text-destructive"
  const sign = direction === "given" ? "+" : "-"
  const showDelete = Boolean(onDelete)

  return (
    <div
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 shadow-sm",
        onClick && "transition-colors hover:bg-muted/40"
      )}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-3 text-left outline-none",
          onClick && "rounded-xl active:bg-muted/60"
        )}
        onClick={onClick}
      >
        <Avatar className="size-11 shrink-0 border-0 bg-sky-100 dark:bg-sky-950/40">
          <AvatarFallback className="bg-transparent text-sm font-bold text-primary">
            {initialsFromName(personName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{personName}</p>
          {typeof entryCount === "number" ? (
            <p className="text-sm text-muted-foreground">
              {entryCount} {entryCount === 1 ? "entry" : "entries"}
            </p>
          ) : null}
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        {showDelete ? <TransactionEntryDeleteButton onClick={() => onDelete?.()} /> : null}
        <div className="text-right">
          <p className={cn("text-base font-bold tabular-nums", amountColor)}>
            {`${sign}${formatCurrency(Math.abs(amountInr))}`}
          </p>
          {statusLabel ? <p className="text-sm text-muted-foreground">{statusLabel}</p> : null}
        </div>
      </div>
    </div>
  )
}
