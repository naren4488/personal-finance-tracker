import type { UdharEntryType } from "@/lib/api/udhar-schemas"

/** Outflow: money left you / you repaid them — account is "Paid From". */
export function isUdharOutflowEntryType(t: UdharEntryType): boolean {
  return t === "money_given" || t === "payment_made"
}

/** Inflow: money came in to you / you borrowed — account is "Received In". */
export function isUdharInflowEntryType(t: UdharEntryType): boolean {
  return t === "money_taken" || t === "payment_received"
}

export function udharAccountSelectLabelForEntryType(
  t: UdharEntryType
): "Paid From" | "Received In" {
  return isUdharOutflowEntryType(t) ? "Paid From" : "Received In"
}
