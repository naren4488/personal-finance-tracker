import type { RecentTransaction } from "@/lib/api/transaction-schemas"

export type UdharBalanceEffect = "receivable" | "payable" | "unknown"

type UdharEntryTypeNorm = "money_given" | "money_taken" | "payment_received" | "payment_made"

function asRec(tx: RecentTransaction): Record<string, unknown> {
  return tx as unknown as Record<string, unknown>
}

function firstString(rec: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function normalizeEntryTypeToken(raw: string): UdharEntryTypeNorm | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_")
  /** Backend entry type values (POST /transactions/udhar). */
  if (
    t === "money_given" ||
    t === "payment_received" ||
    t === "money_taken" ||
    t === "payment_made"
  ) {
    return t
  }
  /** Backend destinationType slugs for person ledger rows. */
  if (t === "person_lend") return "money_given"
  if (t === "person_borrow") return "money_taken"
  if (t === "person_repayment_in") return "payment_received"
  if (t === "person_repayment_out") return "payment_made"
  return null
}

/**
 * Person/Udhar ledger classification source of truth: backend destinationType.
 */
export function extractUdharEntryType(tx: RecentTransaction): UdharEntryTypeNorm | null {
  const rec = asRec(tx)
  const entryType = firstString(rec, ["entryType", "entry_type", "kind"])
  const fromEntryType = entryType ? normalizeEntryTypeToken(entryType) : null
  if (fromEntryType) return fromEntryType

  // Recent endpoint sometimes encodes the udhar direction as income/expense source slug.
  const sourceSlug = firstString(rec, ["incomeSource", "income_source", "category", "title"])
  const fromSourceSlug = sourceSlug ? normalizeEntryTypeToken(sourceSlug) : null
  if (fromSourceSlug) return fromSourceSlug

  const destinationType = firstString(rec, ["destinationType", "destination_type"])
  const fromDestination = destinationType ? normalizeEntryTypeToken(destinationType) : null
  if (fromDestination) return fromDestination

  const txType = typeof rec.type === "string" ? rec.type.trim().toLowerCase() : ""
  const personId = firstString(rec, ["personId", "person_id"])
  if (txType === "expense" && personId) {
    return "money_given"
  }

  return null
}

/**
 * Economic classification for Udhar UI colors.
 * Category inference does not use signedAmount.
 */
export function getUdharEffect(tx: RecentTransaction): UdharBalanceEffect {
  const entryType = extractUdharEntryType(tx)

  if (entryType === "money_given") return "receivable"
  if (entryType === "money_taken") return "payable"
  if (entryType === "payment_received") return "receivable"
  if (entryType === "payment_made") return "payable"
  return "unknown"
}

export function udharEffectTextClassName(effect: UdharBalanceEffect): string {
  if (effect === "receivable") return "text-income"
  if (effect === "payable") return "text-destructive"
  return "text-muted-foreground"
}
