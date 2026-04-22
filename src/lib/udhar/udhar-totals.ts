import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { parseSignedAmountString } from "@/lib/api/transaction-schemas"
import { extractUdharEntryType } from "@/lib/udhar/udhar-effect"

/** Cumulative totals per Udhar entry kind (magnitudes, INR). */
export type UdharQuadrantTotals = {
  given: number
  taken: number
  receivedBack: number
  paidBack: number
  /** Net position from ledger signedAmount sum (source-of-truth sign from backend). */
  net: number
}

/**
 * Sums ledger rows by {@link extractUdharEntryType}:
 * - `money_given` → Given
 * - `money_taken` → Taken
 * - `payment_received` → Received Back
 * - `payment_made` → Paid Back
 * Unknown rows are not forced into any category.
 */
export function aggregateUdharLedgerQuadrantTotals(
  entries: RecentTransaction[]
): UdharQuadrantTotals {
  let given = 0
  let taken = 0
  let receivedBack = 0
  let paidBack = 0
  let net = 0

  for (const tx of entries) {
    net += parseSignedAmountString(tx.signedAmount)
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
    }
  }

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
