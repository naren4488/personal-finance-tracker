import { cn } from "@/lib/utils"

/** Matches People (Udhar) list delete chip — pill, light red. */
export const transactionEntryDeleteChipClass =
  "rounded-full px-3 py-1 text-xs font-semibold bg-[#FCE8E6] text-[#C5221F] transition-opacity hover:opacity-90 dark:bg-rose-950/50 dark:text-rose-200 disabled:pointer-events-none disabled:opacity-50"

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
