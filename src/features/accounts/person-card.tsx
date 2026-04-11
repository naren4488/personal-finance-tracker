import type { Person } from "@/lib/api/people-schemas"
import { getPersonDisplayPhone, getPersonUdharListSummary } from "@/lib/api/people-schemas"
import { cn } from "@/lib/utils"

/** Design reference: light red delete chip */
const chipDelete =
  "rounded-full px-3 py-1 text-xs font-semibold bg-[#FCE8E6] text-[#C5221F] transition-opacity hover:opacity-90 dark:bg-rose-950/50 dark:text-rose-200"

/** Lent / receivable — light green */
const chipAmountLent =
  "rounded-full px-3 py-1 text-xs font-semibold tabular-nums bg-[#E6F4EA] text-[#1E7E34] dark:bg-emerald-950/40 dark:text-emerald-300"

/** Borrowed — light red/green contrast per design language */
const chipAmountBorrowed =
  "rounded-full px-3 py-1 text-xs font-semibold tabular-nums bg-rose-100 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200"

const chipAmountNeutral =
  "rounded-full px-3 py-1 text-xs font-semibold tabular-nums bg-muted text-muted-foreground"

const chipActive =
  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide bg-[#E6F4EA] text-[#1E7E34] dark:bg-emerald-950/40 dark:text-emerald-300"

export type PersonCardProps = {
  person: Person
  /** Opens ledger / detail (main row tap). */
  onClick: (person: Person) => void
  /** Opens delete confirmation in parent; must not trigger `onClick`. */
  onDelete?: (person: Person) => void
}

export function PersonCard({ person, onClick, onDelete }: PersonCardProps) {
  const phone = getPersonDisplayPhone(person)
  const { kind, summary, amountChipLabel } = getPersonUdharListSummary(person)

  const amountChipClass =
    kind === "lent" ? chipAmountLent : kind === "borrowed" ? chipAmountBorrowed : chipAmountNeutral

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
        <p className="truncate text-base font-bold tracking-tight text-[#111827] dark:text-foreground">
          {person.name}
        </p>
        {phone ? (
          <p className="mt-0.5 truncate text-sm text-[#6B7280] tabular-nums dark:text-muted-foreground">
            {phone}
          </p>
        ) : null}
        <p className="mt-0.5 text-sm leading-snug text-[#6B7280] dark:text-muted-foreground">
          {summary}
        </p>
      </button>

      <div
        className="flex shrink-0 flex-wrap items-center justify-end gap-2"
        onClick={(e) => e.stopPropagation()}
        role="presentation"
      >
        {onDelete ? (
          <button
            type="button"
            className={chipDelete}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onDelete(person)
            }}
          >
            Delete
          </button>
        ) : null}
        <span className={amountChipClass}>{amountChipLabel}</span>
        {person.isActive !== false ? (
          <span className={chipActive} aria-label="Active">
            Active
          </span>
        ) : null}
      </div>
    </div>
  )
}
