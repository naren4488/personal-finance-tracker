import { cn } from "@/lib/utils"

/** Full-width line at the bottom of a transaction card for transaction status/context. */
export function TransactionBottomTag({
  label,
  className,
}: {
  label: string | null
  className?: string
}) {
  if (!label) return null
  return (
    <p
      className={cn(
        "border-t border-border/60 bg-muted/25 px-4 py-2 text-left text-xs font-medium text-foreground/90",
        className
      )}
    >
      {label}
    </p>
  )
}

/** Backward-compatible alias while call sites migrate. */
export const EmiTransactionBottomTag = TransactionBottomTag
