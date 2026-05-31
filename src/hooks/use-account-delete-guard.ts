import { useMemo } from "react"
import {
  eligibilityFromLedgerCount,
  type EntityDeleteEligibility,
  type EntityDeleteKind,
} from "@/lib/delete/entity-delete-eligibility"
import { useGetAccountLedgerQuery } from "@/store/api/base-api"

const LEDGER_PROBE_LIMIT = 1

/**
 * Frontend-only delete guard for accounts, loans, and credit cards (all use account ledger).
 * Pass `ledgerEntries` on detail screens to reuse an existing ledger query (limit 500).
 */
export function useAccountDeleteGuard(
  accountId: string | undefined,
  kind: EntityDeleteKind,
  options?: { ledgerEntries?: readonly unknown[]; ledgerFetching?: boolean }
): EntityDeleteEligibility {
  const id = String(accountId ?? "").trim()
  const hasPrefetchedLedger = options?.ledgerEntries !== undefined

  const { data: probeLedger = [], isFetching: probeFetching } = useGetAccountLedgerQuery(
    { accountId: id, limit: LEDGER_PROBE_LIMIT },
    { skip: !id || hasPrefetchedLedger }
  )

  const entryCount = hasPrefetchedLedger
    ? (options?.ledgerEntries?.length ?? 0)
    : probeLedger.length

  const isChecking = hasPrefetchedLedger
    ? Boolean(options?.ledgerFetching)
    : Boolean(id && probeFetching)

  return useMemo(
    () => eligibilityFromLedgerCount(entryCount, kind, { isChecking }),
    [entryCount, kind, isChecking]
  )
}
