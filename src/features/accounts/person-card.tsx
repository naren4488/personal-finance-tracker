import { useMemo } from "react"
import type { Person } from "@/lib/api/people-schemas"
import { getPersonDisplayPhone } from "@/lib/api/people-schemas"
import { formatCurrency } from "@/lib/format"
import { transactionEntryDeleteChipClass } from "@/features/entries/transaction-entry-delete-button"
import { ACTION_GROUP_ROW } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

const chipActive =
  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide bg-[#E6F4EA] text-[#1E7E34] dark:bg-emerald-950/40 dark:text-emerald-300"

export type PersonCardProps = {
  person: Person
  onClick: (person: Person) => void
  onDelete?: (person: Person) => void
}

function parseTotalBalance(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").replace(/\s/g, ""))
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

export function PersonCard({ person, onClick, onDelete }: PersonCardProps) {
  const phone = getPersonDisplayPhone(person)

  const totalBalance = useMemo(() => parseTotalBalance(person.totalBalance), [person.totalBalance])
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
        className={cn(ACTION_GROUP_ROW, "shrink-0")}
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {onDelete ? (
          <button
            type="button"
            className={transactionEntryDeleteChipClass}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(person)
            }}
          >
            Delete
          </button>
        ) : null}
        {person.isActive !== false ? (
          <span className={chipActive} aria-label="Active">
            Active
          </span>
        ) : null}
      </div>
    </div>
  )
}
