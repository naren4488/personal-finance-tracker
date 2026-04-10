import { memo } from "react"
import { ArrowRightLeft } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
  const subtitle = `${fromLabel} → ${toLabel}`
  const secondary = [subtitle, formatDate(tx.date)].filter(Boolean).join(" · ")
  const n = parseSignedAmountString(tx.signedAmount)
  const abs = formatCurrency(Math.abs(n))

  return (
    <div className="flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 text-left shadow-sm">
      <Avatar className="size-11 shrink-0 border-0 bg-sky-100 dark:bg-sky-950/40">
        <AvatarFallback className="bg-transparent p-0">
          <span className="flex size-full items-center justify-center rounded-full">
            <ArrowRightLeft className="size-5 text-primary" strokeWidth={2} aria-hidden />
          </span>
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-foreground">Transfer</p>
        <p className="truncate text-sm text-muted-foreground">{secondary}</p>
      </div>
      <div className="text-right">
        <p className={cn("text-base font-bold tabular-nums text-foreground")}>{abs}</p>
      </div>
    </div>
  )
})
