import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { parseSignedAmountString, udharDirectionLabel } from "@/lib/api/transaction-schemas"

/** Same aggregation as the person detail (ledger) modal — given − taken = net. */
export function aggregateUdharLedgerEntries(entries: RecentTransaction[]): {
  totalLent: number
  totalBorrowed: number
  net: number
} {
  let totalLent = 0
  let totalBorrowed = 0
  for (const tx of entries) {
    const amt = Math.abs(parseSignedAmountString(tx.signedAmount))
    const dir = udharDirectionLabel(tx)
    if (dir === "given") totalLent += amt
    else totalBorrowed += amt
  }
  return { totalLent, totalBorrowed, net: totalLent - totalBorrowed }
}
