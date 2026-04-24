import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import {
  extractUdharEntryType,
  getUdharEffect,
  type UdharBalanceEffect,
} from "@/lib/udhar/udhar-effect"

/** Short label for summary chips (aligned with Money Given / Taken / …). */
export function getUdharEntryTypeLabel(tx: RecentTransaction): string {
  const t = extractUdharEntryType(tx)
  switch (t) {
    case "money_given":
      return "Money Given"
    case "money_taken":
      return "Money Taken"
    case "payment_received":
      return "Payment Received"
    case "payment_made":
      return "Payment Made"
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
      return { arrow: "→", label: "Money Given" }
    case "money_taken":
      return { arrow: "↓", label: "Money Taken" }
    case "payment_received":
      return { arrow: "←", label: "Payment Received" }
    case "payment_made":
      return { arrow: "↑", label: "Payment Made" }
    default: {
      const effect: UdharBalanceEffect = getUdharEffect(tx)
      if (effect === "receivable") return { arrow: "→", label: "Receivable" }
      if (effect === "payable") return { arrow: "↓", label: "Payable" }
      return { arrow: "•", label: "Uncategorized" }
    }
  }
}
