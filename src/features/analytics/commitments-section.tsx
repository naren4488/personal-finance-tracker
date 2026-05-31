import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Commitment } from "@/lib/api/commitment-schemas"
import { sortCommitmentsNewestFirst } from "@/lib/commitments/commitment-list-order"
import {
  buildEntityCatalog,
  COMMITMENTS_LIST_MAX_HEIGHT_CLASS,
  type EntityCatalog,
} from "@/lib/commitments/commitment-kind-config"
import { ANALYTICS_COMMITMENTS_SECTION_ID } from "@/lib/commitments/focus-commitments-section"
import { CommitmentListRow } from "@/features/analytics/commitment-list-row"
import type { Account } from "@/lib/api/account-schemas"
import type { Person } from "@/lib/api/people-schemas"
import { cn } from "@/lib/utils"

export type CommitmentsSectionProps = {
  commitments: Commitment[]
  loading: boolean
  error: boolean
  errorMessage?: string
  /** Optional catalogs for linked-entity subtitles on rows */
  people?: Person[]
  loans?: Account[]
  creditCards?: Account[]
  allAccounts?: Account[]
  /** Transaction ids for deleted-entity checks on row click. */
  transactions?: { id: string }[]
}

export function CommitmentsSection({
  commitments,
  loading,
  error,
  errorMessage,
  people = [],
  loans = [],
  creditCards = [],
  allAccounts = [],
  transactions = [],
}: CommitmentsSectionProps) {
  const sorted = useMemo(() => sortCommitmentsNewestFirst(commitments), [commitments])

  const catalog: EntityCatalog | undefined = useMemo(() => {
    if (
      !people.length &&
      !loans.length &&
      !creditCards.length &&
      !allAccounts.length &&
      !transactions.length
    ) {
      return undefined
    }
    return buildEntityCatalog({ people, loans, creditCards, allAccounts, transactions })
  }, [people, loans, creditCards, allAccounts, transactions])

  return (
    <Card
      id={ANALYTICS_COMMITMENTS_SECTION_ID}
      tabIndex={-1}
      className="rounded-2xl border-border shadow-sm scroll-mt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold">Commitments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0 p-0 pt-0">
        {loading ? (
          <p className="px-6 py-4 text-center text-sm text-muted-foreground">
            Loading commitments…
          </p>
        ) : error ? (
          <p className="px-6 py-3 text-sm text-destructive">
            {errorMessage ?? "Could not load commitments."}
          </p>
        ) : sorted.length === 0 ? (
          <p className="px-6 py-4 text-center text-sm text-muted-foreground">No commitments yet.</p>
        ) : (
          <div
            className={cn(
              COMMITMENTS_LIST_MAX_HEIGHT_CLASS,
              "overflow-y-auto overscroll-contain px-6 pb-4 [-webkit-overflow-scrolling:touch]"
            )}
            role="region"
            aria-label="Commitments list"
          >
            {sorted.map((c) => (
              <CommitmentListRow key={c.id} commitment={c} catalog={catalog} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
