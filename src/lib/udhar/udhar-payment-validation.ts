import type { UdharAccountPersonBalance } from "@/lib/api/udhar-summary-schemas"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"

/**
 * Client-side guard before POST /transactions/udhar for payment rows.
 * We only validate basic amount shape here; business caps are enforced on the server.
 */
export function validateUdharPaymentAgainstBalances(
  _entryType: UdharEntryType,
  amountInr: number,
  _row: UdharAccountPersonBalance | undefined
): { ok: true } | { ok: false; message: string } {
  void _entryType
  void _row

  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return { ok: false, message: "Enter a valid amount" }
  }

  return { ok: true }
}
