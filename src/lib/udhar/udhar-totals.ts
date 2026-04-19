import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { parseSignedAmountString } from "@/lib/api/transaction-schemas"
import { extractUdharEntryType } from "@/lib/udhar/udhar-effect"

/**
 * Net position for a person from ledger rows.
 * - `person_lend` / `person_borrow` rows are split by **title** (see {@link extractUdharEntryType}),
 *   not by the sign of `signedAmount` alone.
 * - Other rows keep the legacy split: positive `signedAmount` → receivable side, negative → payable.
 */
export function aggregateUdharLedgerEntries(entries: RecentTransaction[]): {
  totalLent: number
  totalBorrowed: number
  net: number
} {
  let sumPositive = 0
  let sumNegativeAbs = 0
  let net = 0
  for (const tx of entries) {
    const s = parseSignedAmountString(tx.signedAmount)
    const mag = Math.abs(s)
    const entryType = extractUdharEntryType(tx)

    if (entryType === "money_given") {
      sumPositive += mag
      net += mag
    } else if (entryType === "money_taken") {
      sumNegativeAbs += mag
      net -= mag
    } else {
      net += s
      if (s > 0) sumPositive += s
      else if (s < 0) sumNegativeAbs += -s
    }
  }
  return {
    totalLent: sumPositive,
    totalBorrowed: sumNegativeAbs,
    net,
  }
}
