import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import type { Person } from "@/lib/api/people-schemas"
import { getPersonDisplayPhone, getPersonUdharTotals } from "@/lib/api/people-schemas"
import { personNetAmountClassName, personNetBalanceLine } from "@/lib/people/person-balance-display"
import type { EntityDeleteEligibility } from "@/lib/delete/entity-delete-eligibility"
import {
  EntityListCardActiveBadge,
  EntityListCardLetterAvatar,
  EntityListCardShell,
} from "@/features/accounts/entity-list-card"
import {
  entityListCardAvatarLetter,
  entityListCardFooterBtnClass,
} from "@/features/accounts/entity-list-card-styles"
import { cn } from "@/lib/utils"

export type PersonCardProps = {
  person: Person
  onClick: (person: Person) => void
  onDelete?: (person: Person) => void
  deleteGuard?: EntityDeleteEligibility
}

export function PersonCard({ person, onClick, onDelete, deleteGuard }: PersonCardProps) {
  const name = person.name?.trim() || "Person"
  const phone = getPersonDisplayPhone(person)
  const totalBalance = useMemo(() => getPersonUdharTotals(person).totalBalance, [person])
  const deleteBlocked = Boolean(deleteGuard?.blocked)
  const deleteHint =
    deleteGuard?.message ?? (deleteGuard?.isChecking ? "Checking transaction history…" : null)

  return (
    <EntityListCardShell
      onOpen={() => onClick(person)}
      openAriaLabel={`Open ${name}`}
      avatar={<EntityListCardLetterAvatar letter={entityListCardAvatarLetter(name)} />}
      title={name}
      subtitle={phone || null}
      metric={
        <p
          className={cn(
            "text-2xl font-bold tabular-nums tracking-tight sm:text-[1.75rem]",
            personNetAmountClassName(totalBalance)
          )}
        >
          {personNetBalanceLine(totalBalance)}
        </p>
      }
      footer={
        <>
          {onDelete ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                entityListCardFooterBtnClass,
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
          <EntityListCardActiveBadge active={person.isActive !== false} />
        </>
      }
      footerHint={deleteHint}
    />
  )
}
