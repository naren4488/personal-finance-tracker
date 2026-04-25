import { transactionEntryDeleteChipClass } from "@/features/entries/transaction-entry-delete-classes"
import { cn } from "@/lib/utils"

type TransactionEntryDeleteButtonProps = {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  className?: string
}

/**
 * Reusable Delete control for transaction / ledger rows (entries, home, account detail, udhar).
 * Stops propagation so row click handlers (e.g. open detail) do not fire.
 */
export function TransactionEntryDeleteButton({
  onClick,
  disabled,
  className,
}: TransactionEntryDeleteButtonProps) {
  return (
    <button
      type="button"
      className={cn(transactionEntryDeleteChipClass, "shrink-0", className)}
      disabled={disabled}
      aria-label="Delete entry"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClick(e)
      }}
    >
      Delete
    </button>
  )
}
