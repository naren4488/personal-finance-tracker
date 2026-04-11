import { z } from "zod"

/** One row from GET /transactions/udhar-summary — must match server ledger rollups. */
export type UdharAccountPersonBalance = {
  personId: string
  totalLent: number
  totalBorrowed: number
  net: number
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
  return { personId: pid, totalLent, totalBorrowed, net }
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
