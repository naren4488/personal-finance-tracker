import { memo } from "react"
import { TransactionListRow } from "@/features/entries/transaction-list-row"
import type { Account } from "@/lib/api/account-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"

export const RecentTransactionRow = memo(function RecentTransactionRow({
  tx,
  accounts,
  onDelete,
  className,
  amountStyle,
}: {
  tx: RecentTransaction
  accounts?: Account[]
  onDelete?: (tx: RecentTransaction) => void
  className?: string
  amountStyle?: "signed" | "udhar-ledger"
}) {
  return (
    <TransactionListRow
      tx={tx}
      displayOptions={accounts?.length ? { accounts } : undefined}
      onDelete={onDelete}
      className={className}
      amountStyle={amountStyle}
    />
  )
})
