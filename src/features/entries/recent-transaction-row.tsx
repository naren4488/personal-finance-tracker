import { memo } from "react"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import { TransferTransactionRow } from "@/features/entries/transfer-transaction-row"
import { buildRecentTxSubtitleLine } from "@/features/entries/transaction-list-utils"
import type { Account } from "@/lib/api/account-schemas"
import { formatCurrency, formatDate } from "@/lib/format"
import { parseSignedAmountString, type RecentTransaction } from "@/lib/api/transaction-schemas"
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
}: {
  tx: RecentTransaction
  accounts?: Account[]
  /** When set, shows Delete chip (same behavior for income, expense, udhar-shaped rows, etc.). */
  onDelete?: (tx: RecentTransaction) => void
}) {
  if (tx.type === "transfer" && accounts && accounts.length > 0) {
    return <TransferTransactionRow tx={tx} accounts={accounts} onDelete={onDelete} />
  }

  const n = parseSignedAmountString(tx.signedAmount)
  const isIncome = tx.type === "income"
  const isExpense = tx.type === "expense"
  const secondary = accounts?.length
    ? buildRecentTxSubtitleLine(tx, accounts)
    : [formatDate(tx.date), tx.subtitle?.trim()].filter(Boolean).join(" · ")

  const showDelete = Boolean(onDelete && String(tx.id ?? "").trim())

  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3.5 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-tight text-[#111827] dark:text-foreground">
          {tx.title}
        </p>
        <p className="mt-1 truncate text-xs leading-snug text-[#6B7280] dark:text-muted-foreground">
          {secondary}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
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
  )
})
