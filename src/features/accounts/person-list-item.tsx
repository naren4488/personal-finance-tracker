import type { Person } from "@/lib/api/people-schemas"
import { PersonCard } from "@/features/accounts/person-card"
import { usePersonDeleteGuard } from "@/hooks/use-person-delete-guard"

export type PersonListItemProps = {
  person: Person
  onClick: (person: Person) => void
  onDelete?: (person: Person) => void
}

/** Person row with frontend delete guard (person or linked-account ledger probe). */
export function PersonListItem({ person, onClick, onDelete }: PersonListItemProps) {
  const deleteGuard = usePersonDeleteGuard(onDelete ? person : null)

  return (
    <PersonCard
      person={person}
      onClick={onClick}
      onDelete={onDelete}
      deleteGuard={onDelete ? deleteGuard : undefined}
    />
  )
}
