import { memo } from "react"
import { TransactionListRow } from "@/features/entries/transaction-list-row"
import type { EntityCatalog } from "@/lib/commitments/commitment-kind-config"
import type { Account } from "@/lib/api/account-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"

export const RecentTransactionRow = memo(function RecentTransactionRow({
  tx,
  accounts,
  onDelete,
  className,
  amountStyle,
  catalog,
}: {
  tx: RecentTransaction
  accounts?: Account[]
  onDelete?: (tx: RecentTransaction) => void
  className?: string
  amountStyle?: "signed" | "udhar-ledger"
  catalog?: EntityCatalog
}) {
  return (
    <TransactionListRow
      tx={tx}
      displayOptions={accounts?.length ? { accounts } : undefined}
      onDelete={onDelete}
      className={className}
      amountStyle={amountStyle}
      catalog={catalog}
    />
  )
})
