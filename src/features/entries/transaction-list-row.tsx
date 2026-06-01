import { memo } from "react"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import {
  getTransactionRowDisplayFields,
  type TransactionRowDisplayOptions,
} from "@/features/entries/transaction-row-display"
import { formatCurrency } from "@/lib/format"
import { parseSignedAmountString, type RecentTransaction } from "@/lib/api/transaction-schemas"
import { getUdharEffect, udharEffectTextClassName } from "@/lib/udhar/udhar-effect"
import { ACTION_GROUP_ROW_TX } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

function formatSignedInrDisplay(signedAmount: string): string {
  const n = parseSignedAmountString(signedAmount)
  const abs = formatCurrency(Math.abs(n))
  if (n < 0) return `−${abs}`
  if (n > 0) return `+${abs}`
  return abs
}

export type TransactionListRowProps = {
  tx: RecentTransaction
  onDelete?: (tx: RecentTransaction) => void
  className?: string
  /** Person ledger keeps absolute amount + Udhar effect colors. */
  amountStyle?: "signed" | "udhar-ledger"
  displayOptions?: TransactionRowDisplayOptions
}

function LabeledDetailLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs leading-snug text-muted-foreground">
      <span className="font-medium text-foreground/90">{label}:</span> {value}
    </p>
  )
}

export const TransactionListRow = memo(function TransactionListRow({
  tx,
  onDelete,
  className,
  amountStyle = "signed",
  displayOptions,
}: TransactionListRowProps) {
  const { lines } = getTransactionRowDisplayFields(tx, displayOptions)
  const n = parseSignedAmountString(tx.signedAmount)
  const isIncome = tx.type === "income"
  const isExpense = tx.type === "expense"
  const showDelete = Boolean(onDelete && String(tx.id ?? "").trim())
  const udharEffect = amountStyle === "udhar-ledger" ? getUdharEffect(tx) : null
  const absAmt = Math.abs(n)

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1 space-y-0.5">
          {lines.map((row, index) => (
            <LabeledDetailLine key={`${row.label}-${index}`} label={row.label} value={row.value} />
          ))}
        </div>
        <div className={cn(ACTION_GROUP_ROW_TX, "shrink-0")}>
          {showDelete ? <TransactionEntryDeleteButton onClick={() => onDelete?.(tx)} /> : null}
          {amountStyle === "udhar-ledger" ? (
            <p
              className={cn(
                "text-right text-base font-bold tabular-nums tracking-tight",
                absAmt === 0 ? "text-muted-foreground" : udharEffectTextClassName(udharEffect!)
              )}
            >
              {formatCurrency(absAmt)}
            </p>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
})
