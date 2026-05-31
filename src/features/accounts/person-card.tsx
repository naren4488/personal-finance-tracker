import { useMemo } from "react"
import type { Person } from "@/lib/api/people-schemas"
import { getPersonDisplayPhone, getPersonUdharTotals } from "@/lib/api/people-schemas"
import { personNetAmountClassName, personNetBalanceLine } from "@/lib/people/person-balance-display"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { EntityDeleteEligibility } from "@/lib/delete/entity-delete-eligibility"
import { ACTION_GROUP_CARD_RAIL } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

const personFooterBtn =
  "rounded-full px-3 text-xs font-semibold shadow-none sm:h-8 sm:px-3.5 sm:text-xs"

export type PersonCardProps = {
  person: Person
  onClick: (person: Person) => void
  onDelete?: (person: Person) => void
  deleteGuard?: EntityDeleteEligibility
}

export function PersonCard({ person, onClick, onDelete, deleteGuard }: PersonCardProps) {
  const phone = getPersonDisplayPhone(person)

  const totalBalance = useMemo(() => getPersonUdharTotals(person).totalBalance, [person])
  const deleteBlocked = Boolean(deleteGuard?.blocked)
  const deleteHint =
    deleteGuard?.message ?? (deleteGuard?.isChecking ? "Checking transaction history…" : null)

  const body = (
    <>
      <p className={cn("mt-1 text-sm", personNetAmountClassName(totalBalance))}>
        {personNetBalanceLine(totalBalance)}
      </p>
    </>
  )

  return (
    <div className="w-full rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left outline-none transition-opacity hover:opacity-95"
          onClick={() => onClick(person)}
        >
          <p className="text-base font-bold tracking-tight text-foreground">{person.name}</p>
          {phone ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground tabular-nums">{phone}</p>
          ) : null}
          {body}
        </button>

        <div
          className={ACTION_GROUP_CARD_RAIL}
          onClick={(e) => e.stopPropagation()}
          role="presentation"
        >
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                personFooterBtn,
                "border-destructive/45 text-destructive hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/15"
              )}
              disabled={deleteBlocked}
              title={deleteHint ?? undefined}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (deleteBlocked) return
                onDelete(person)
              }}
            >
              Delete
            </Button>
          ) : null}
          <Badge
            variant="outline"
            className={cn(
              "h-7 shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              person.isActive !== false
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "text-muted-foreground"
            )}
          >
            {person.isActive !== false ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
      {deleteHint ? (
        <p className="mt-2 text-xs leading-snug text-muted-foreground" role="status">
          {deleteHint}
        </p>
      ) : null}
    </div>
  )
}
