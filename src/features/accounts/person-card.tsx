import { useMemo } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { UdharAccountPersonBalance } from "@/lib/api/udhar-summary-schemas"
import type { Person } from "@/lib/api/people-schemas"
import {
  getPersonDisplayPhone,
  getPersonUdharListSummaryFromTotals,
  type PersonUdharListSummary,
} from "@/lib/api/people-schemas"
import { transactionEntryDeleteChipClass } from "@/features/entries/transaction-entry-delete-button"
import { ACTION_GROUP_ROW } from "@/lib/ui/action-group-classes"
import { cn } from "@/lib/utils"

const chipActive =
  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide bg-[#E6F4EA] text-[#1E7E34] dark:bg-emerald-950/40 dark:text-emerald-300"

export type PersonCardProps = {
  person: Person
  onClick: (person: Person) => void
  onDelete?: (person: Person) => void
  /** Aggregated from GET /transactions/ledger (same as detail modal). */
  ledgerBalance?: UdharAccountPersonBalance
  /** True until ledger for this person has been loaded or errored. */
  balancePending?: boolean
  balanceError?: string | null
}

export function PersonCard({
  person,
  onClick,
  onDelete,
  ledgerBalance,
  balancePending,
  balanceError,
}: PersonCardProps) {
  const phone = getPersonDisplayPhone(person)

  const summary: PersonUdharListSummary | "loading" | "error" = useMemo(() => {
    if (balanceError) return "error"
    if (balancePending || !ledgerBalance) return "loading"
    return getPersonUdharListSummaryFromTotals(ledgerBalance.totalLent, ledgerBalance.totalBorrowed)
  }, [balanceError, balancePending, ledgerBalance])

  const body =
    summary === "loading" ? (
      <div className="mt-2 space-y-2">
        <Skeleton className="h-4 w-44 max-w-full" />
        <Skeleton className="h-3 w-56 max-w-full" />
      </div>
    ) : summary === "error" ? (
      <p className="mt-1 text-sm text-destructive">{balanceError ?? "Could not load balance"}</p>
    ) : (
      <>
        <p
          className={cn(
            "mt-1 text-sm font-semibold tabular-nums leading-snug",
            summary.amountTextClassName
          )}
        >
          {summary.amountChipLabel}
        </p>
        <p className="mt-0.5 text-sm leading-snug text-[#6B7280] dark:text-muted-foreground">
          {summary.summary}
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
