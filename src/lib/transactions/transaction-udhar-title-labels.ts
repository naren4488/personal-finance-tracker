import type { UdharApiEntryType } from "@/lib/udhar/udhar-effect"

export const UDHAR_DISPLAY_YOU_PAID = "You Paid"
export const UDHAR_DISPLAY_YOU_RECEIVED = "You Received"

/** Slug / API token → user-facing label (two categories only). */
const UDhar_TITLE_SLUG_LABELS: Record<string, string> = {
  money_given: UDHAR_DISPLAY_YOU_PAID,
  person_lend: UDHAR_DISPLAY_YOU_PAID,
  person_payment: UDHAR_DISPLAY_YOU_PAID,
  person_repayment_out: UDHAR_DISPLAY_YOU_PAID,
  payment_made: UDHAR_DISPLAY_YOU_PAID,
  money_taken: UDHAR_DISPLAY_YOU_RECEIVED,
  person_borrow: UDHAR_DISPLAY_YOU_RECEIVED,
  person_repayment: UDHAR_DISPLAY_YOU_RECEIVED,
  person_repayment_in: UDHAR_DISPLAY_YOU_RECEIVED,
  payment_received: UDHAR_DISPLAY_YOU_RECEIVED,
}

/** Prior UI strings — API may still send these as humanized `title` values. */
const LEGACY_UDhar_ACTION_DISPLAY_LABELS: readonly string[] = [
  "Money Given",
  "Money Taken",
  "Money Paid",
  "Money Received",
  "Payment Received",
  "Payment Made",
  "Received Back",
  "Paid Back",
  UDHAR_DISPLAY_YOU_PAID,
  UDHAR_DISPLAY_YOU_RECEIVED,
]

export function normalizeUdharTitleSlugKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_")
}

/** Returns a display label when `raw` is a known slug; otherwise null. */
export function mapUdharTitleSlugToLabel(raw: string): string | null {
  const key = normalizeUdharTitleSlugKey(raw)
  if (!key) return null
  return UDhar_TITLE_SLUG_LABELS[key] ?? null
}

export function isKnownUdharTitleSlug(raw: string): boolean {
  return mapUdharTitleSlugToLabel(raw) !== null
}

/** User-facing label for a normalized API entry type (includes legacy payment rows). */
export function getUdharEntryTypeDisplayLabel(
  type: UdharApiEntryType | null | undefined
): string | null {
  if (!type) return null
  return UDhar_TITLE_SLUG_LABELS[type] ?? null
}

/** Labels produced by {@link mapUdharTitleSlugToLabel} and legacy humanized API titles. */
export const UDhar_ACTION_DISPLAY_LABELS: ReadonlySet<string> = new Set([
  ...Object.values(UDhar_TITLE_SLUG_LABELS),
  ...LEGACY_UDhar_ACTION_DISPLAY_LABELS,
])

export function isUdharActionDisplayLabel(value: string): boolean {
  const t = value.trim()
  return t.length > 0 && UDhar_ACTION_DISPLAY_LABELS.has(t)
}
