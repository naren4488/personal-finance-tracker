import {
  type UdharAccountPersonBalance,
  getPayablePaymentCap,
  getReceivablePaymentCap,
} from "@/lib/api/udhar-summary-schemas"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"

const EPS = 1e-6

/**
 * Client-side guard before POST /transactions/udhar for payment rows.
 * Caps match GET /transactions/udhar-summary: receivable remaining for `payment_received`,
 * payable remaining for `payment_made` (see {@link getReceivablePaymentCap} / {@link getPayablePaymentCap}).
 * Authoritative validation must still run on the server.
 */
export function validateUdharPaymentAgainstBalances(
  entryType: UdharEntryType,
  amountInr: number,
  row: UdharAccountPersonBalance | undefined
): { ok: true } | { ok: false; message: string } {
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return { ok: false, message: "Enter a valid amount" }
  }

  if (entryType === "payment_received") {
    const cap = getReceivablePaymentCap(row)
    if (cap <= 0) {
      return {
        ok: false,
        message: "No receivable balance for this person on this account.",
      }
    }
    if (amountInr > cap + EPS) {
      return {
        ok: false,
        message: "Received amount cannot exceed total lent amount",
      }
    }
    return { ok: true }
  }

  if (entryType === "payment_made") {
    const cap = getPayablePaymentCap(row)
    if (cap <= 0) {
      return {
        ok: false,
        message: "No payable balance for this person on this account.",
      }
    }
    if (amountInr > cap + EPS) {
      return {
        ok: false,
        message: "Paid amount cannot exceed total borrowed amount",
      }
    }
    return { ok: true }
  }

  return { ok: true }
}
