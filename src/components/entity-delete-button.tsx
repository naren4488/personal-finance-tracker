import { Button } from "@/components/ui/button"
import type { EntityDeleteEligibility } from "@/lib/delete/entity-delete-eligibility"
import { cn } from "@/lib/utils"
import type { ComponentProps, ReactNode } from "react"

type EntityDeleteButtonProps = {
  guard: EntityDeleteEligibility
  onDelete: () => void
  label?: string
  className?: string
  variant?: ComponentProps<typeof Button>["variant"]
  size?: ComponentProps<typeof Button>["size"]
  icon?: ReactNode
}

/**
 * Destructive delete control with disabled state when entity has ledger history.
 */
export function EntityDeleteButton({
  guard,
  onDelete,
  label = "Delete",
  className,
  variant = "destructive",
  size,
  icon,
}: EntityDeleteButtonProps) {
  const disabled = guard.blocked
  const hint = guard.message ?? (guard.isChecking ? "Checking transaction history…" : null)

  return (
    <div className="min-w-0">
      <Button
        type="button"
        variant={variant}
        size={size}
        className={cn("w-full font-semibold", className)}
        disabled={disabled}
        aria-disabled={disabled}
        title={hint ?? undefined}
        onClick={() => {
          if (disabled) return
          onDelete()
        }}
      >
        {icon}
        {label}
      </Button>
      {hint ? (
        <p className="mt-1.5 text-xs leading-snug text-muted-foreground" role="status">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
