import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import {
  extractUdharEntryType,
  getUdharEffect,
  type UdharBalanceEffect,
} from "@/lib/udhar/udhar-effect"

/** Short label for list rows (Lent / Borrowed / Received / Paid). */
export function getUdharEntryTypeLabel(tx: RecentTransaction): string {
  const t = extractUdharEntryType(tx)
  switch (t) {
    case "money_given":
      return "Lent"
    case "money_taken":
      return "Borrowed"
    case "payment_received":
      return "Received"
    case "payment_made":
      return "Paid"
    default: {
      const effect: UdharBalanceEffect = getUdharEffect(tx)
      return effect === "receivable" ? "Receivable" : "Payable"
    }
  }
}
