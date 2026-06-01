/**
 * Fixed presentation labels for known Udhar / person transaction title slugs from the API.
 * No other display text should be derived on the frontend.
 */
const UDhar_TITLE_SLUG_LABELS: Record<string, string> = {
  person_lend: "Money Given",
  person_borrow: "Money Taken",
  person_repayment: "Money Received",
  person_payment: "Money Paid",
  // Common API aliases (same presentation mapping)
  person_repayment_in: "Money Received",
  person_repayment_out: "Money Paid",
  payment_received: "Money Received",
  payment_made: "Money Paid",
  money_given: "Money Given",
  money_taken: "Money Taken",
}

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

/** Labels produced by {@link mapUdharTitleSlugToLabel} (also when API already sends humanized `title`). */
export const UDhar_ACTION_DISPLAY_LABELS: ReadonlySet<string> = new Set(
  Object.values(UDhar_TITLE_SLUG_LABELS)
)

export function isUdharActionDisplayLabel(value: string): boolean {
  const t = value.trim()
  return t.length > 0 && UDhar_ACTION_DISPLAY_LABELS.has(t)
}
