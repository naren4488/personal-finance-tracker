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
      return "Received Back"
    case "payment_made":
      return "Paid Back"
    default: {
      const effect: UdharBalanceEffect = getUdharEffect(tx)
      if (effect === "receivable") return "Receivable"
      if (effect === "payable") return "Payable"
      return "Uncategorized"
    }
  }
}

/** People ledger: direction + category (e.g. "← Received", "↓ Taken") for full-ledger rows. */
export function getUdharLedgerRowHeading(tx: RecentTransaction): { arrow: string; label: string } {
  const t = extractUdharEntryType(tx)
  switch (t) {
    case "money_given":
      return { arrow: "→", label: "Given" }
    case "money_taken":
      return { arrow: "↓", label: "Taken" }
    case "payment_received":
      return { arrow: "←", label: "Received Back" }
    case "payment_made":
      return { arrow: "↑", label: "Paid Back" }
    default: {
      const effect: UdharBalanceEffect = getUdharEffect(tx)
      if (effect === "receivable") return { arrow: "→", label: "Receivable" }
      if (effect === "payable") return { arrow: "↓", label: "Payable" }
      return { arrow: "•", label: "Uncategorized" }
    }
  }
}
