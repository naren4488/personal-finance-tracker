import { useMemo } from "react"
import {
  eligibilityFromPersonLedger,
  type EntityDeleteEligibility,
} from "@/lib/delete/entity-delete-eligibility"
import { resolvePersonDeleteTarget } from "@/lib/people/person-delete"
import type { Person } from "@/lib/api/people-schemas"
import { useGetAccountLedgerQuery, useGetPersonLedgerQuery } from "@/store/api/base-api"

const LEDGER_PROBE_LIMIT = 1

/**
 * Frontend-only delete guard for people / udhar entities.
 * Uses person ledger or linked-account ledger depending on `resolvePersonDeleteTarget`.
 */
export function usePersonDeleteGuard(
  person: Person | null | undefined,
  options?: { ledgerEntries?: readonly unknown[]; ledgerFetching?: boolean }
): EntityDeleteEligibility & { targetMode: "account" | "person" | null } {
  const target = useMemo(() => (person ? resolvePersonDeleteTarget(person) : null), [person])

  const accountId = target?.mode === "account" ? target.id : ""
  const personId = target?.mode === "person" ? target.id : ""
  const hasPrefetchedLedger = options?.ledgerEntries !== undefined

  const { data: accountProbe = [], isFetching: accountFetching } = useGetAccountLedgerQuery(
    { accountId, limit: LEDGER_PROBE_LIMIT },
    { skip: !accountId || hasPrefetchedLedger || target?.mode !== "account" }
  )

  const { data: personProbe = [], isFetching: personFetching } = useGetPersonLedgerQuery(
    { personId, limit: LEDGER_PROBE_LIMIT },
    { skip: !personId || hasPrefetchedLedger || target?.mode !== "person" }
  )

  const entryCount = useMemo(() => {
    if (hasPrefetchedLedger) return options?.ledgerEntries?.length ?? 0
    if (target?.mode === "account") return accountProbe.length
    if (target?.mode === "person") return personProbe.length
    return 0
  }, [
    hasPrefetchedLedger,
    options?.ledgerEntries,
    target?.mode,
    accountProbe.length,
    personProbe.length,
  ])

  const isChecking = useMemo(() => {
    if (!target) return false
    if (hasPrefetchedLedger) return Boolean(options?.ledgerFetching)
    if (target.mode === "account") return accountFetching
    return personFetching
  }, [target, hasPrefetchedLedger, options?.ledgerFetching, accountFetching, personFetching])

  const eligibility = useMemo(() => {
    if (!target) return { blocked: false, message: null, isChecking: false }
    return eligibilityFromPersonLedger(entryCount, target.mode, { isChecking })
  }, [target, entryCount, isChecking])

  return {
    ...eligibility,
    targetMode: target?.mode ?? null,
  }
}
