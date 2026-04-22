import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { parseSignedAmountString } from "@/lib/api/transaction-schemas"
import { extractUdharEntryType } from "@/lib/udhar/udhar-effect"

/** Cumulative totals per Udhar entry kind (magnitudes, INR). */
export type UdharQuadrantTotals = {
  given: number
  taken: number
  receivedBack: number
  paidBack: number
  /**
   * Net position: Given − Taken + Received Back − Paid Back
   * (equivalently (Given + Received Back) − (Taken + Paid Back) for typed rows).
   */
  net: number
}

/**
 * Sums ledger rows by {@link extractUdharEntryType}:
 * - `money_given` → Given
 * - `money_taken` → Taken
 * - `payment_received` → Received Back
 * - `payment_made` → Paid Back
 * Unknown rows: positive `signedAmount` → Given, negative → Taken (absolute), so `net` stays
 * consistent with the legacy sign split.
 */
export function aggregateUdharLedgerQuadrantTotals(
  entries: RecentTransaction[]
): UdharQuadrantTotals {
  let given = 0
  let taken = 0
  let receivedBack = 0
  let paidBack = 0

  for (const tx of entries) {
    const mag = Math.abs(parseSignedAmountString(tx.signedAmount))
    const entryType = extractUdharEntryType(tx)

    if (entryType === "money_given") {
      given += mag
    } else if (entryType === "money_taken") {
      taken += mag
    } else if (entryType === "payment_received") {
      receivedBack += mag
    } else if (entryType === "payment_made") {
      paidBack += mag
    } else {
      const s = parseSignedAmountString(tx.signedAmount)
      if (s > 0) {
        given += s
      } else if (s < 0) {
        taken += -s
      }
    }
  }

  const net = given - taken + receivedBack - paidBack
  return { given, taken, receivedBack, paidBack, net }
}

/**
 * Legacy shape for list rollups: “receivable side” = Given + Received Back, “payable side” = Taken + Paid Back.
 * Prefer {@link aggregateUdharLedgerQuadrantTotals} for UI that shows all four categories.
 */
export function aggregateUdharLedgerEntries(entries: RecentTransaction[]): {
  totalLent: number
  totalBorrowed: number
  net: number
} {
  const q = aggregateUdharLedgerQuadrantTotals(entries)
  return {
    totalLent: q.given + q.receivedBack,
    totalBorrowed: q.taken + q.paidBack,
    net: q.net,
  }
}
