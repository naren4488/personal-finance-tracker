import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { parseSignedAmountString } from "@/lib/api/transaction-schemas"

/**
 * Net position for a person from ledger rows — **sum of backend `signedAmount` only**.
 * - Positive signed amounts → receivable side; negative → payable side.
 * `totalLent` / `totalBorrowed` are the split magnitudes so `net === totalLent - totalBorrowed`
 * and {@link getPersonUdharListSummaryFromTotals} stays unchanged.
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
    net += s
    if (s > 0) sumPositive += s
    else if (s < 0) sumNegativeAbs += -s
  }
  return {
    totalLent: sumPositive,
    totalBorrowed: sumNegativeAbs,
    net,
  }
}
