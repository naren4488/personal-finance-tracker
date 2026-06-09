import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Person } from "@/lib/api/people-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { AccountCardSkeleton } from "@/features/accounts/account-card"
import { PersonListItem } from "@/features/accounts/person-list-item"
import { Users } from "lucide-react"

export type PeopleListProps = {
  people: Person[]
  loading: boolean
  error: unknown | null
  onRetry: () => void
  /** Empty state: opens shared Udhar entry sheet (e.g. from People tab). */
  onAddClick?: () => void
  onPersonClick: (person: Person) => void
  onPersonDelete?: (person: Person) => void
  /** Shown under "No people found" when the list is empty */
  emptyStateSubtext?: string
}

export function PeopleList({
  people,
  loading,
  error,
  onRetry,
  onAddClick,
  onPersonClick,
  onPersonDelete,
  emptyStateSubtext = "Add someone or link people to this account to see them here.",
}: PeopleListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5" aria-busy aria-label="Loading people">
        <AccountCardSkeleton />
        <AccountCardSkeleton />
        <AccountCardSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4">
        <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
        <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={onRetry}>
          Retry
        </Button>
      </div>
    )
  }

  if (people.length === 0) {
    return (
      <Card className="flex min-h-0 flex-1 flex-col border-2 border-dashed border-border/90 bg-card py-0 shadow-none">
        <CardContent className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/80">
            <Users className="size-7 text-primary" strokeWidth={2} aria-hidden />
          </div>
          <p className="text-base font-bold text-primary">No people found</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">{emptyStateSubtext}</p>
          {onAddClick ? (
            <Button
              type="button"
              className="mt-6 h-11 rounded-xl px-8 text-base font-semibold"
              onClick={onAddClick}
            >
              + Add
            </Button>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-2.5" aria-label="People list">
      {people.map((person) => {
        return (
          <li key={person.id}>
            <PersonListItem person={person} onClick={onPersonClick} onDelete={onPersonDelete} />
          </li>
        )
      })}
    </ul>
  )
}
