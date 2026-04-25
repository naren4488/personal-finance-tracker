import { useMemo } from "react"
import type { Person } from "@/lib/api/people-schemas"
import { getPersonDisplayPhone, parsePersonTotalBalance } from "@/lib/api/people-schemas"
import { formatCurrency } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ACTION_GROUP_CARD_RAIL } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

const personFooterBtn =
  "rounded-full px-3 text-xs font-semibold shadow-none sm:h-8 sm:px-3.5 sm:text-xs"

export type PersonCardProps = {
  person: Person
  onClick: (person: Person) => void
  onDelete?: (person: Person) => void
}

export function PersonCard({ person, onClick, onDelete }: PersonCardProps) {
  const phone = getPersonDisplayPhone(person)

  const totalBalance = useMemo(
    () => parsePersonTotalBalance(person.totalBalance),
    [person.totalBalance]
  )
  const absFormatted = useMemo(() => formatCurrency(Math.abs(totalBalance)), [totalBalance])

  const body = (
    <>
      <p
        className={cn(
          "mt-1 text-sm font-semibold tabular-nums leading-snug",
          totalBalance > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : totalBalance < 0
              ? "text-red-600 dark:text-red-400"
              : "text-muted-foreground"
        )}
      >
        {totalBalance > 0
          ? `You will get ${absFormatted}`
          : totalBalance < 0
            ? `You will give ${absFormatted}`
            : "Settled"}
      </p>
    </>
  )

  return (
    <div
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-card px-4 py-3 shadow-sm",
        "dark:border-border"
      )}
    >
      <button
        type="button"
        className="min-w-0 flex-1 text-left outline-none transition-opacity hover:opacity-95"
        onClick={() => onClick(person)}
      >
        <p className="text-base font-bold tracking-tight text-[#111827] dark:text-foreground">
          {person.name}
        </p>
        {phone ? (
          <p className="mt-0.5 truncate text-sm text-[#6B7280] tabular-nums dark:text-muted-foreground">
            {phone}
          </p>
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
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
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
  )
}
