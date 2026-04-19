import { parseSignedAmountString, type RecentTransaction } from "@/lib/api/transaction-schemas"

export type UdharBalanceEffect = "receivable" | "payable"

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

function parsePositiveMoney(v: unknown): number | null {
  if (v === undefined || v === null) return null
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return v
  if (typeof v === "string") {
    const n = Number(String(v).replace(/,/g, "").replace(/\s/g, "").trim())
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return null
}

/** True when backend (or notes) indicates received payment created / increased payable (excess over receivable). */
function indicatesPaymentReceivedExcessPayable(rec: Record<string, unknown>): boolean {
  const keys = [
    "excessAmount",
    "excess_amount",
    "overpaymentAmount",
    "overpayment_amount",
    "payableFromExcess",
    "payable_from_excess",
  ] as const
  for (const k of keys) {
    if (parsePositiveMoney(rec[k]) != null) return true
  }
  if (rec.isExcess === true || rec.is_excess === true) return true
  if (rec.createsPayable === true || rec.creates_payable === true) return true
  const hay = `${rec.note ?? ""} ${rec.subtitle ?? ""} ${rec.title ?? ""}`.toLowerCase()
  if (/(^|\s)(excess|overpayment|over-payment|over payment)(\s|$)/i.test(hay)) return true
  return false
}

/** True when backend (or notes) indicates paid amount created / increased receivable (excess over payable). */
function indicatesPaymentMadeExcessReceivable(rec: Record<string, unknown>): boolean {
  const keys = [
    "excessAmount",
    "excess_amount",
    "overpaymentAmount",
    "overpayment_amount",
    "receivableFromExcess",
    "receivable_from_excess",
  ] as const
  for (const k of keys) {
    if (parsePositiveMoney(rec[k]) != null) return true
  }
  if (rec.isExcess === true || rec.is_excess === true) return true
  if (rec.createsReceivable === true || rec.creates_receivable === true) return true
  const hay = `${rec.note ?? ""} ${rec.subtitle ?? ""} ${rec.title ?? ""}`.toLowerCase()
  if (/(^|\s)(excess|overpayment|over-payment|over payment)(\s|$)/i.test(hay)) return true
  return false
}

function normalizeEntryTypeToken(raw: string): UdharEntryTypeNorm | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_")
  /** Backend ledger slugs — semantic meaning is in `title`, not `type`/`direction`/`signedAmount` sign. */
  if (t === "person_lend") return "money_given"
  if (t === "person_borrow") return "money_taken"
  if (t === "money_given" || t === "moneygiven" || t === "lent" || t === "given")
    return "money_given"
  if (t === "money_taken" || t === "moneytaken" || t === "borrowed" || t === "taken")
    return "money_taken"
  if (t === "payment_received" || t === "paymentreceived") return "payment_received"
  if (t === "payment_made" || t === "paymentmade") return "payment_made"
  return null
}

/** Infer `money_*` / `payment_*` from slugs like `person_lend`, `person_payment_received`. */
function inferEntryTypeFromSlug(hay: string): UdharEntryTypeNorm | null {
  const s = hay.toLowerCase()
  if (s.includes("person_lend")) return "money_given"
  if (s.includes("person_borrow")) return "money_taken"
  if (s.includes("payment_received") || s.includes("payment-received")) return "payment_received"
  if (s.includes("payment_made") || s.includes("payment-made")) return "payment_made"
  if (s.includes("money_given") || s.includes("money-given")) return "money_given"
  if (s.includes("money_taken") || s.includes("money-taken")) return "money_taken"
  return null
}

/**
 * Best-effort Udhar entry type from API / passthrough fields (no contract changes).
 */
export function extractUdharEntryType(tx: RecentTransaction): UdharEntryTypeNorm | null {
  const rec = asRec(tx)
  const fromFields = firstString(rec, [
    "entryType",
    "udharEntryType",
    "udhar_entry_type",
    "transactionEntryType",
    "transaction_entry_type",
    "udharType",
    "udhar_type",
  ])
  if (fromFields) {
    const n = normalizeEntryTypeToken(fromFields)
    if (n) return n
  }

  const kind = typeof rec.kind === "string" ? rec.kind.trim() : ""
  if (kind) {
    const n = normalizeEntryTypeToken(kind)
    if (n) return n
    const fromKind = inferEntryTypeFromSlug(kind)
    if (fromKind) return fromKind
  }

  const title = typeof tx.title === "string" ? tx.title.trim() : ""
  if (title) {
    const fromTitleToken = normalizeEntryTypeToken(title)
    if (fromTitleToken) return fromTitleToken
    const fromTitle = inferEntryTypeFromSlug(title)
    if (fromTitle) return fromTitle
  }

  const rawTitle = firstString(rec, [
    "originalTitle",
    "rawTitle",
    "transactionKind",
    "transaction_kind",
  ])
  if (rawTitle) {
    const fromRaw = inferEntryTypeFromSlug(rawTitle)
    if (fromRaw) return fromRaw
  }

  return null
}

/**
 * Economic classification for Udhar UI (color + labels).
 * Does not use `signedAmount` for lend/borrow when `title` is `person_lend` / `person_borrow`.
 * Fallback when type is unknown: sign of `signedAmount` (positive → receivable, negative → payable).
 */
export function getUdharEffect(tx: RecentTransaction): UdharBalanceEffect {
  const rec = asRec(tx)
  const entryType = extractUdharEntryType(tx)

  if (entryType === "money_given") return "receivable"
  if (entryType === "money_taken") return "payable"

  if (entryType === "payment_received") {
    if (indicatesPaymentReceivedExcessPayable(rec)) return "payable"
    return "receivable"
  }

  if (entryType === "payment_made") {
    if (indicatesPaymentMadeExcessReceivable(rec)) return "receivable"
    return "payable"
  }

  const n = parseSignedAmountString(tx.signedAmount)
  if (n > 0) return "receivable"
  if (n < 0) return "payable"
  return "receivable"
}

export function udharEffectTextClassName(effect: UdharBalanceEffect): string {
  return effect === "receivable" ? "text-income" : "text-destructive"
}
