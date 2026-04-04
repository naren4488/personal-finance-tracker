import { memo } from "react"
import { ArrowRightLeft, TrendingDown, TrendingUp } from "lucide-react"
import { formatCurrency, formatDate } from "@/lib/format"
import { parseSignedAmountString, type RecentTransaction } from "@/lib/api/transaction-schemas"
import { cn } from "@/lib/utils"

function formatSignedDisplay(signedAmount: string): string {
  const n = parseSignedAmountString(signedAmount)
  const abs = formatCurrency(Math.abs(n))
  if (n < 0) return `−${abs}`
  if (n > 0) return `+${abs}`
  return abs
}

export const RecentTransactionRow = memo(function RecentTransactionRow({
  tx,
}: {
  tx: RecentTransaction
}) {
  const isIncome = tx.type === "income"
  const isExpense = tx.type === "expense"
  const secondary = [tx.subtitle.trim(), formatDate(tx.date)].filter(Boolean).join(" · ")

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2.5 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            isIncome && "bg-income/15",
            isExpense && "bg-expense/15",
            !isIncome && !isExpense && "bg-muted"
          )}
        >
          {isIncome ? (
            <TrendingUp className="size-4 text-income" strokeWidth={2} aria-hidden />
          ) : isExpense ? (
            <TrendingDown className="size-4 text-expense" strokeWidth={2} aria-hidden />
          ) : (
            <ArrowRightLeft className="size-4 text-muted-foreground" strokeWidth={2} aria-hidden />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{tx.title}</p>
          <p className="truncate text-xs text-muted-foreground">{secondary}</p>
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-bold tabular-nums",
          isIncome && "text-income",
          isExpense && "text-expense",
          !isIncome && !isExpense && "text-muted-foreground"
        )}
      >
        {formatSignedDisplay(tx.signedAmount)}
      </span>
    </div>
  )
})
