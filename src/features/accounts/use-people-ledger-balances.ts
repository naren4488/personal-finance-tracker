import { useEffect, useMemo, useRef, useState } from "react"
import { getErrorMessage } from "@/lib/api/errors"
import type { UdharAccountPersonBalance } from "@/lib/api/udhar-summary-schemas"
import type { Person } from "@/lib/api/people-schemas"
import { aggregateUdharLedgerEntries } from "@/lib/udhar/udhar-totals"
import { baseApi } from "@/store/api/base-api"
import { useLazyGetPersonLedgerQuery } from "@/store/api/base-api"
import type { RootState } from "@/store"
import { store } from "@/store"

const LEDGER_LIMIT = 500

function selectLedgerState(personId: string) {
  return baseApi.endpoints.getPersonLedger.select({ personId, limit: LEDGER_LIMIT })
}

export function readPersonLedgerCache(personId: string) {
  const slice = selectLedgerState(personId)(store.getState() as RootState)
  if (slice.status === "fulfilled" && slice.data) return slice.data
  return null
}

function toBalanceRow(
  personId: string,
  entries: Parameters<typeof aggregateUdharLedgerEntries>[0]
) {
  const { totalLent, totalBorrowed, net } = aggregateUdharLedgerEntries(entries)
  const row: UdharAccountPersonBalance = { personId, totalLent, totalBorrowed, net }
  if (import.meta.env.DEV) {
    console.log("[People ledger balance]", personId, {
      transactionCount: entries.length,
      signedAmountSum: net,
      receivableTotal: totalLent,
      payableTotal: totalBorrowed,
      sample: entries.slice(0, 5).map((t) => ({
        id: t.id,
        signedAmount: t.signedAmount,
      })),
    })
  }
  return row
}

/**
 * Fetches GET /transactions/ledger per person in a throttled queue, merges into a map.
 * Reads RTK cache first to avoid duplicate network calls when data was already loaded (e.g. detail open).
 */
export function usePeopleLedgerBalances(
  people: Person[],
  enabled: boolean,
  concurrency = 2,
  /** Bumps when GET /people refetches (e.g. after udhar entry) so balances reload. */
  peopleListUpdatedAt?: number
): {
  balanceByPersonId: Map<string, UdharAccountPersonBalance>
  balanceErrorByPersonId: Map<string, string>
  pendingPersonIds: Set<string>
} {
  const [fetchLedger] = useLazyGetPersonLedgerQuery()
  const [balanceByPersonId, setBalanceByPersonId] = useState<
    Map<string, UdharAccountPersonBalance>
  >(() => new Map())
  const [balanceErrorByPersonId, setBalanceErrorByPersonId] = useState<Map<string, string>>(
    () => new Map()
  )
  const [pendingPersonIds, setPendingPersonIds] = useState<Set<string>>(() => new Set())
  const runGeneration = useRef(0)

  const peopleKey = useMemo(
    () =>
      people
        .map((p) => p.id)
        .sort()
        .join("|"),
    [people]
  )
  const listUpdatedAt = peopleListUpdatedAt ?? 0

  useEffect(() => {
    if (!enabled || people.length === 0) {
      setBalanceByPersonId(new Map())
      setBalanceErrorByPersonId(new Map())
      setPendingPersonIds(new Set())
      return
    }

    let active = true
    const generation = ++runGeneration.current
    const personIds = people.map((p) => p.id)

    setPendingPersonIds(new Set(personIds))
    setBalanceErrorByPersonId(new Map())

    async function loadOne(personId: string): Promise<void> {
      const cached = readPersonLedgerCache(personId)
      if (cached) {
        if (!active || generation !== runGeneration.current) return
        const row = toBalanceRow(personId, cached)
        setBalanceByPersonId((prev) => {
          const next = new Map(prev)
          next.set(personId, row)
          return next
        })
        setBalanceErrorByPersonId((prev) => {
          if (!prev.has(personId)) return prev
          const next = new Map(prev)
          next.delete(personId)
          return next
        })
        setPendingPersonIds((prev) => {
          const next = new Set(prev)
          next.delete(personId)
          return next
        })
        return
      }

      try {
        const entries = await fetchLedger({ personId, limit: LEDGER_LIMIT }).unwrap()
        if (!active || generation !== runGeneration.current) return
        const row = toBalanceRow(personId, entries)
        setBalanceByPersonId((prev) => {
          const next = new Map(prev)
          next.set(personId, row)
          return next
        })
        setBalanceErrorByPersonId((prev) => {
          const next = new Map(prev)
          next.delete(personId)
          return next
        })
      } catch (e) {
        if (!active || generation !== runGeneration.current) return
        const msg = getErrorMessage(e) || "Could not load balance"
        setBalanceErrorByPersonId((prev) => new Map(prev).set(personId, msg))
      } finally {
        if (active && generation === runGeneration.current) {
          setPendingPersonIds((prev) => {
            const next = new Set(prev)
            next.delete(personId)
            return next
          })
        }
      }
    }

    async function runPool() {
      const queue = [...personIds]
      const n = Math.max(1, Math.min(concurrency, queue.length))
      const workers = Array.from({ length: n }, async () => {
        while (active && generation === runGeneration.current && queue.length > 0) {
          const id = queue.shift()
          if (!id) break
          await loadOne(id)
        }
      })
      await Promise.all(workers)
    }

    void runPool()

    return () => {
      active = false
    }
    /* peopleKey mirrors `people` ids; listUpdatedAt bumps when GET /people refetches. */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- peopleKey + listUpdatedAt cover list changes
  }, [enabled, peopleKey, fetchLedger, concurrency, listUpdatedAt])

  return { balanceByPersonId, balanceErrorByPersonId, pendingPersonIds }
}
