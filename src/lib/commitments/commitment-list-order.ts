import type { Commitment } from "@/lib/api/commitment-schemas"

function commitmentCreatedAtMs(commitment: Commitment): number {
  const rec = commitment as Record<string, unknown>
  const raw =
    (typeof commitment.createdAt === "string" && commitment.createdAt.trim()) ||
    firstStringFromRecord(rec, ["createdAt", "created_at"])
  if (!raw) return 0
  const t = Date.parse(raw)
  return Number.isNaN(t) ? 0 : t
}

function firstStringFromRecord(rec: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

/** Newest commitments first — prefers `createdAt`, then numeric id descending. */
export function compareCommitmentsNewestFirst(a: Commitment, b: Commitment): number {
  const aCreated = commitmentCreatedAtMs(a)
  const bCreated = commitmentCreatedAtMs(b)
  if (aCreated !== bCreated) return bCreated - aCreated

  const aId = String(a.id)
  const bId = String(b.id)
  const aNum = Number(aId)
  const bNum = Number(bId)
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) {
    return bNum - aNum
  }

  return bId.localeCompare(aId)
}

export function sortCommitmentsNewestFirst(commitments: Commitment[]): Commitment[] {
  return [...commitments].sort(compareCommitmentsNewestFirst)
}

/** Ensures optimistic rows sort to the top when the API omits `createdAt`. */
export function withCommitmentCreatedAtFallback(row: Commitment): Commitment {
  const rec = row as Record<string, unknown>
  const existing =
    (typeof row.createdAt === "string" && row.createdAt.trim()) ||
    firstStringFromRecord(rec, ["createdAt", "created_at"])
  if (existing) return row
  return { ...row, createdAt: new Date().toISOString() }
}
