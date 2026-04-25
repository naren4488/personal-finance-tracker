import { memo } from "react"
import { TransactionBottomTag } from "@/features/entries/emi-transaction-bottom-tag"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import {
  buildTransactionBottomLabel,
  buildRecentTxPrimaryTitle,
  buildRecentTxSubtitleParts,
} from "@/features/entries/transaction-list-utils"
import { parseSignedAmountString, type RecentTransaction } from "@/lib/api/transaction-schemas"
import type { Account } from "@/lib/api/account-schemas"
import { formatCurrency } from "@/lib/format"
import { ACTION_GROUP_ROW_TX } from "@/lib/ui/action-group-classes"
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
  const primaryTitle = buildRecentTxPrimaryTitle(tx)
  const sub = buildRecentTxSubtitleParts(tx, accounts)
  const bottomLabel = buildTransactionBottomLabel(tx, accounts)
  const n = parseSignedAmountString(tx.signedAmount)
  const abs = formatCurrency(Math.abs(n))
  const amountText = n < 0 ? `−${abs}` : n > 0 ? `+${abs}` : abs

  const showDelete = Boolean(onDelete && String(tx.id ?? "").trim())

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-left shadow-sm",
        className
      )}
    >
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold leading-tight text-[#111827] dark:text-foreground">
            {primaryTitle}
          </p>
          {sub.line1 ? (
            <p className="mt-1 text-xs leading-snug text-[#6B7280] dark:text-muted-foreground">
              {sub.line1}
            </p>
          ) : null}
          {sub.line2 ? (
            <p className="mt-0.5 wrap-break-word text-xs leading-snug text-[#6B7280] dark:text-muted-foreground">
              {sub.line2}
            </p>
          ) : null}
        </div>
        <div className={cn(ACTION_GROUP_ROW_TX, "shrink-0")}>
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
      <TransactionBottomTag label={bottomLabel} />
    </div>
  )
})
