import { memo } from "react"
import {
  getTransferRouteLabels,
  parseSignedAmountString,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import type { Account } from "@/lib/api/account-schemas"
import { formatCurrency, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"

export const TransferTransactionRow = memo(function TransferTransactionRow({
  tx,
  accounts,
}: {
  tx: RecentTransaction
  accounts: Account[]
}) {
  const { fromLabel, toLabel } = getTransferRouteLabels(tx, accounts)
  const route = `${fromLabel} → ${toLabel}`
  const secondary = [formatDate(tx.date), route].filter(Boolean).join(" · ")
  const n = parseSignedAmountString(tx.signedAmount)
  const abs = formatCurrency(Math.abs(n))
  const amountText = n < 0 ? `−${abs}` : n > 0 ? `+${abs}` : abs

  return (
    <div className="flex w-full items-start justify-between gap-3 rounded-2xl border border-border/80 bg-card px-4 py-3.5 text-left shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold leading-tight text-[#111827] dark:text-foreground">
          Transfer
        </p>
        <p className="mt-1 truncate text-xs leading-snug text-[#6B7280] dark:text-muted-foreground">
          {secondary}
        </p>
      </div>
      <p
        className={cn(
          "shrink-0 text-right text-base font-bold tabular-nums tracking-tight",
          n < 0 && "text-destructive",
          n > 0 && "text-income",
          n === 0 && "text-muted-foreground"
        )}
      >
        {amountText}
      </p>
    </div>
  )
})
