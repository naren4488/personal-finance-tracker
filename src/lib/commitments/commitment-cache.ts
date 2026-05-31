import type { Commitment } from "@/lib/api/commitment-schemas"
import {
  sortCommitmentsNewestFirst,
  withCommitmentCreatedAtFallback,
} from "@/lib/commitments/commitment-list-order"

/** Upsert into RTK Query Immer draft for `getCommitments` (newest first). */
export function upsertCommitmentInListDraft(draft: Commitment[], row: Commitment): void {
  const normalized = withCommitmentCreatedAtFallback(row)
  const id = String(normalized.id)
  const idx = draft.findIndex((c) => String(c.id) === id)
  if (idx >= 0) {
    draft[idx] = normalized
  } else {
    draft.unshift(normalized)
  }
  const sorted = sortCommitmentsNewestFirst(draft)
  draft.splice(0, draft.length, ...sorted)
}
