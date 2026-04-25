import { memo } from "react"
import { TransactionBottomTag } from "@/features/entries/emi-transaction-bottom-tag"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import { TransferTransactionRow } from "@/features/entries/transfer-transaction-row"
import {
  buildTransactionBottomLabel,
  buildRecentTxPrimaryTitle,
  buildRecentTxSubtitleParts,
} from "@/features/entries/transaction-list-utils"
import type { Account } from "@/lib/api/account-schemas"
import { formatCurrency, formatDate } from "@/lib/format"
import { parseSignedAmountString, type RecentTransaction } from "@/lib/api/transaction-schemas"
import { ACTION_GROUP_ROW_TX } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

function formatSignedInrDisplay(signedAmount: string): string {
  const n = parseSignedAmountString(signedAmount)
  const abs = formatCurrency(Math.abs(n))
  if (n < 0) return `−${abs}`
  if (n > 0) return `+${abs}`
  return abs
}

export const RecentTransactionRow = memo(function RecentTransactionRow({
  tx,
  accounts,
  onDelete,
  className,
}: {
  tx: RecentTransaction
  accounts?: Account[]
  onDelete?: (tx: RecentTransaction) => void
  className?: string
}) {
  if (tx.type === "transfer" && accounts && accounts.length > 0) {
    return (
      <TransferTransactionRow
        tx={tx}
        accounts={accounts}
        onDelete={onDelete}
        className={className}
      />
    )
  }

  const n = parseSignedAmountString(tx.signedAmount)
  const isIncome = tx.type === "income"
  const isExpense = tx.type === "expense"
  const primaryTitle = buildRecentTxPrimaryTitle(tx)
  const bottomLabel = buildTransactionBottomLabel(tx, accounts ?? [])

  const sub = accounts?.length
    ? buildRecentTxSubtitleParts(tx, accounts)
    : {
        line1: [formatDate(tx.date), tx.subtitle?.trim()].filter(Boolean).join(" · "),
        line2: null as string | null,
      }

  const showDelete = Boolean(onDelete && String(tx.id ?? "").trim())

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
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
          <span
            className={cn(
              "text-right text-base font-bold tabular-nums tracking-tight",
              isIncome && "text-income",
              isExpense && "text-destructive",
              !isIncome &&
                !isExpense &&
                (n < 0 ? "text-destructive" : n > 0 ? "text-income" : "text-muted-foreground")
            )}
          >
            {formatSignedInrDisplay(tx.signedAmount)}
          </span>
        </div>
      </div>
      <TransactionBottomTag label={bottomLabel} />
    </div>
  )
})
