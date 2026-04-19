import { z } from "zod"

/**
 * One row from GET /transactions/udhar-summary — must match server ledger rollups.
 *
 * - `totalLent` / `totalBorrowed`: usually **outstanding** magnitudes (receivable / payable).
 * - `receivableRemaining` / `payableRemaining`: optional explicit caps when the API sends them
 *   or when gross vs paid components are present (see {@link normalizeBalanceRow}).
 */
export type UdharAccountPersonBalance = {
  personId: string
  totalLent: number
  totalBorrowed: number
  net: number
  /** receivableBalance ≈ total_lent − total_received — use for payment_received caps when set. */
  receivableRemaining?: number
  /** payableBalance ≈ total_borrowed − total_paid — use for payment_made caps when set. */
  payableRemaining?: number
}

/** Max receivable that can be settled with `payment_received` (never negative). */
export function getReceivablePaymentCap(row: UdharAccountPersonBalance | undefined): number {
  if (!row) return 0
  if (row.receivableRemaining !== undefined && Number.isFinite(row.receivableRemaining)) {
    return Math.max(0, row.receivableRemaining)
  }
  return Math.max(0, row.totalLent)
}

/** Max payable that can be settled with `payment_made` (never negative). */
export function getPayablePaymentCap(row: UdharAccountPersonBalance | undefined): number {
  if (!row) return 0
  if (row.payableRemaining !== undefined && Number.isFinite(row.payableRemaining)) {
    return Math.max(0, row.payableRemaining)
  }
  return Math.max(0, row.totalBorrowed)
}

function parseNumish(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").replace(/\s/g, "").trim())
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

function normalizeBalanceRow(raw: Record<string, unknown>): UdharAccountPersonBalance | null {
  const pidRaw = raw.personId ?? raw.person_id ?? raw.id
  const pid = typeof pidRaw === "string" ? pidRaw.trim() : ""
  if (!pid) return null

  let totalLent = parseNumish(raw.totalLent ?? raw.totalGiven ?? raw.total_given ?? raw.givenTotal)
  let totalBorrowed = parseNumish(
    raw.totalBorrowed ?? raw.totalTaken ?? raw.total_taken ?? raw.takenTotal
  )

  const netFromApi = raw.net ?? raw.netBalance ?? raw.net_balance
  const hasNetField = netFromApi !== undefined && netFromApi !== null

  const hasLentBorrowed =
    raw.totalLent != null ||
    raw.totalBorrowed != null ||
    raw.totalGiven != null ||
    raw.totalTaken != null ||
    raw.total_given != null ||
    raw.total_taken != null

  if (!hasLentBorrowed && !hasNetField) {
    return { personId: pid, totalLent: 0, totalBorrowed: 0, net: 0 }
  }

  if (!hasLentBorrowed && hasNetField) {
    const n = parseNumish(netFromApi)
    if (n > 0) {
      totalLent = n
      totalBorrowed = 0
    } else if (n < 0) {
      totalLent = 0
      totalBorrowed = -n
    } else {
      totalLent = 0
      totalBorrowed = 0
    }
    return { personId: pid, totalLent, totalBorrowed, net: totalLent - totalBorrowed }
  }

  const net = hasNetField ? parseNumish(netFromApi) : totalLent - totalBorrowed

  let receivableRemaining: number | undefined
  let payableRemaining: number | undefined

  const explicitReceivable =
    raw.receivableRemaining ??
    raw.receivable_remaining ??
    raw.receivableBalance ??
    raw.receivable_balance ??
    raw.remainingReceivable ??
    raw.remaining_receivable ??
    raw.outstandingReceivable
  if (explicitReceivable !== undefined && explicitReceivable !== null) {
    receivableRemaining = parseNumish(explicitReceivable)
  }

  const explicitPayable =
    raw.payableRemaining ??
    raw.payable_remaining ??
    raw.payableBalance ??
    raw.payable_balance ??
    raw.remainingPayable ??
    raw.remaining_payable ??
    raw.outstandingPayable
  if (explicitPayable !== undefined && explicitPayable !== null) {
    payableRemaining = parseNumish(explicitPayable)
  }

  const grossLent = raw.totalLentGross ?? raw.grossLent ?? raw.total_lent_gross ?? raw.gross_lent
  const totalReceived = raw.totalReceived ?? raw.total_received ?? raw.paymentsReceived
  if (
    receivableRemaining === undefined &&
    grossLent !== undefined &&
    grossLent !== null &&
    totalReceived !== undefined &&
    totalReceived !== null
  ) {
    receivableRemaining = Math.max(0, parseNumish(grossLent) - parseNumish(totalReceived))
  }

  const grossBorrowed =
    raw.totalBorrowedGross ?? raw.grossBorrowed ?? raw.total_borrowed_gross ?? raw.gross_borrowed
  const totalPaid = raw.totalPaid ?? raw.total_paid ?? raw.paymentsMade
  if (
    payableRemaining === undefined &&
    grossBorrowed !== undefined &&
    grossBorrowed !== null &&
    totalPaid !== undefined &&
    totalPaid !== null
  ) {
    payableRemaining = Math.max(0, parseNumish(grossBorrowed) - parseNumish(totalPaid))
  }

  const base: UdharAccountPersonBalance = { personId: pid, totalLent, totalBorrowed, net }
  if (receivableRemaining !== undefined) base.receivableRemaining = receivableRemaining
  if (payableRemaining !== undefined) base.payableRemaining = payableRemaining
  return base
}

const balanceRowSchema = z.record(z.string(), z.unknown())

export function parseGetUdharAccountBalancesSuccess(
  raw: unknown
): { ok: true; balances: UdharAccountPersonBalance[] } | { ok: false; error: string } {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, error: "Invalid udhar summary response." }
  }
  const root = raw as Record<string, unknown>

  let rows: unknown[] = []
  if (Array.isArray(root)) {
    rows = root
  } else if (root.success === false) {
    return { ok: false, error: "Request failed." }
  } else {
    const data = root.data
    if (Array.isArray(data)) {
      rows = data
    } else if (data && typeof data === "object" && !Array.isArray(data)) {
      const d = data as Record<string, unknown>
      const inner = d.balances ?? d.items ?? d.rows ?? d.people ?? d.data
      if (Array.isArray(inner)) rows = inner
    }
  }

  const balances: UdharAccountPersonBalance[] = []
  for (const item of rows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue
    const rec = balanceRowSchema.safeParse(item)
    if (!rec.success) continue
    const row = normalizeBalanceRow(rec.data)
    if (row) balances.push(row)
  }

  return { ok: true, balances }
}
