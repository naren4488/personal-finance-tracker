import { memo } from "react"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import {
  getTransferRouteLabels,
  inferUdharPersonName,
  isUdharRecentTransaction,
  parseSignedAmountString,
  udharDirectionLabel,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import type { Account } from "@/lib/api/account-schemas"
import { formatCurrency, formatDate } from "@/lib/format"
import { ACTION_GROUP_ROW } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

export const TransferTransactionRow = memo(function TransferTransactionRow({
  tx,
  accounts,
  onDelete,
  className,
}: {
  tx: RecentTransaction
  accounts: Account[]
  onDelete?: (tx: RecentTransaction) => void
  className?: string
}) {
  const personTransferPhrase = (() => {
    if (!isUdharRecentTransaction(tx)) return ""
    const personName = inferUdharPersonName(tx)
    const safePerson = personName === "Unknown" ? "Unknown person" : personName
    const rec = tx as unknown as Record<string, unknown>
    const raw = [
      typeof rec.kind === "string" ? rec.kind : "",
      typeof rec.title === "string" ? rec.title : "",
      typeof rec.subtitle === "string" ? rec.subtitle : "",
      typeof rec.note === "string" ? rec.note : "",
    ]
      .join(" ")
      .toLowerCase()
    if (raw.includes("payment_received") || raw.includes("payment received")) {
      return `Transfer from ${safePerson}`
    }
    if (raw.includes("payment_made") || raw.includes("payment made")) {
      return `Transfer to ${safePerson}`
    }
    const dir = udharDirectionLabel(tx)
    return dir === "given" ? `Transfer to ${safePerson}` : `Transfer from ${safePerson}`
  })()

  const { fromLabel, toLabel } = getTransferRouteLabels(tx, accounts)
  const route = `${fromLabel} → ${toLabel}`
  const secondary = [formatDate(tx.date), personTransferPhrase || route].filter(Boolean).join(" · ")
  const n = parseSignedAmountString(tx.signedAmount)
  const abs = formatCurrency(Math.abs(n))
  const amountText = n < 0 ? `−${abs}` : n > 0 ? `+${abs}` : abs

  const showDelete = Boolean(onDelete && String(tx.id ?? "").trim())

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3.5 text-left shadow-sm",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-tight text-[#111827] dark:text-foreground">
          Transfer
        </p>
        <p className="mt-1 truncate text-xs leading-snug text-[#6B7280] dark:text-muted-foreground">
          {secondary}
        </p>
      </div>
      <div className={cn(ACTION_GROUP_ROW, "shrink-0")}>
        {showDelete ? <TransactionEntryDeleteButton onClick={() => onDelete?.(tx)} /> : null}
        <p
          className={cn(
            "text-right text-base font-bold tabular-nums tracking-tight",
            n < 0 && "text-destructive",
            n > 0 && "text-income",
            n === 0 && "text-muted-foreground"
          )}
        >
          {amountText}
        </p>
      </div>
    </div>
  )
})
