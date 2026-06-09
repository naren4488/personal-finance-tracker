import type { UdharEntryType } from "@/lib/api/udhar-schemas"

/** Outflow: money left you — account is "Paid From". */
export function isUdharOutflowEntryType(t: UdharEntryType): boolean {
  return t === "money_given"
}

/** Inflow: money came to you — account is "Received In". */
export function isUdharInflowEntryType(t: UdharEntryType): boolean {
  return t === "money_taken"
}

export function udharAccountSelectLabelForEntryType(
  t: UdharEntryType
): "Paid From" | "Received In" {
  return isUdharOutflowEntryType(t) ? "Paid From" : "Received In"
}
