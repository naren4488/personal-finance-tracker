import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Person } from "@/lib/api/people-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { PersonCard } from "@/features/accounts/person-card"
import { Users } from "lucide-react"

function PersonCardSkeleton() {
  return (
    <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-card px-4 py-3 shadow-sm dark:border-border">
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-full max-w-56" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-14 rounded-full" />
      </div>
    </div>
  )
}

export type PeopleListProps = {
  people: Person[]
  loading: boolean
  error: unknown | null
  onRetry: () => void
  onPersonClick: (person: Person) => void
  onPersonDelete?: (person: Person) => void
}

export function PeopleList({
  people,
  loading,
  error,
  onRetry,
  onPersonClick,
  onPersonDelete,
}: PeopleListProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2.5" aria-busy aria-label="Loading people">
        <PersonCardSkeleton />
        <PersonCardSkeleton />
        <PersonCardSkeleton />
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
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            Add someone or link people to this account to see them here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <ul className="flex list-none flex-col gap-2.5" aria-label="People list">
      {people.map((person) => (
        <li key={person.id}>
          <PersonCard person={person} onClick={onPersonClick} onDelete={onPersonDelete} />
        </li>
      ))}
    </ul>
  )
}
