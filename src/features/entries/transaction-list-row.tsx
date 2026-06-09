import { ChevronRight } from "lucide-react"
import { memo } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { TransactionEntryDeleteButton } from "@/features/entries/transaction-entry-delete-button"
import {
  getTransactionRowDisplayFields,
  type TransactionRowDisplayOptions,
} from "@/features/entries/transaction-row-display"
import type { EntityCatalog } from "@/lib/commitments/commitment-kind-config"
import { formatCurrency } from "@/lib/format"
import { parseSignedAmountString, type RecentTransaction } from "@/lib/api/transaction-schemas"
import { resolveTransactionRowAction } from "@/lib/transactions/resolve-transaction-navigation"
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
  catalog?: EntityCatalog
}

function LabeledDetailLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-xs leading-snug text-muted-foreground">
      <span className="font-medium text-foreground/90">{label}:</span> {value}
    </p>
  )
}

const cardShellClass =
  "flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"

export const TransactionListRow = memo(function TransactionListRow({
  tx,
  onDelete,
  className,
  amountStyle = "signed",
  displayOptions,
  catalog,
}: TransactionListRowProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { lines } = getTransactionRowDisplayFields(tx, displayOptions)
  const n = parseSignedAmountString(tx.signedAmount)
  const isIncome = tx.type === "income"
  const isExpense = tx.type === "expense"
  const showDelete = Boolean(onDelete && String(tx.id ?? "").trim())
  const udharEffect = amountStyle === "udhar-ledger" ? getUdharEffect(tx) : null
  const absAmt = Math.abs(n)
  const action = resolveTransactionRowAction(tx, catalog, { currentPath: location.pathname })
  const isNavigable = action.type !== "none"

  const rowBody = (
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
  )

  function handleClick() {
    if (action.type === "navigate") {
      navigate(action.path)
      return
    }
    if (action.type === "toast") {
      toast.error(action.message)
    }
  }

  if (!isNavigable) {
    return <div className={cn(cardShellClass, className)}>{rowBody}</div>
  }

  const primaryLine = lines[0]?.value ?? "Transaction"
  const ariaLabel =
    action.type === "navigate"
      ? `${primaryLine}, ${action.label}`
      : `${primaryLine}, linked entity unavailable`

  return (
    <button
      type="button"
      className={cn(
        cardShellClass,
        "w-full text-left transition-colors hover:bg-muted/30 active:bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      onClick={handleClick}
      aria-label={ariaLabel}
    >
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">{rowBody}</div>
        <ChevronRight
          className="mr-3 mt-4 size-4 shrink-0 text-muted-foreground"
          strokeWidth={2}
          aria-hidden
        />
      </div>
    </button>
  )
})
