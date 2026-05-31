import type { Person } from "@/lib/api/people-schemas"
import { getPersonDisplayPhone } from "@/lib/api/people-schemas"
import type { RecentTransaction } from "@/lib/api/transaction-schemas"
import { isUdharRecentTransaction } from "@/lib/api/transaction-schemas"

/** Far-past `fromDate` for recent-transaction queries used in people ordering. */
export const PEOPLE_ACTIVITY_FROM_DATE = "2000-01-01"

export function peopleActivityToDate(now: Date = new Date()): string {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseDateToMs(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null
  const ms = Date.parse(value.trim())
  return Number.isFinite(ms) ? ms : null
}

function personIdFromTransaction(tx: RecentTransaction): string | null {
  const rec = tx as unknown as Record<string, unknown>
  const id = rec.personId ?? rec.person_id
  if (typeof id === "string" && id.trim()) return id.trim()
  return null
}

/** Latest Udhar transaction timestamp per person from GET /transactions/recent. */
export function buildPersonUdharActivityIndex(
  transactions: RecentTransaction[]
): Map<string, number> {
  const map = new Map<string, number>()
  for (const tx of transactions) {
    if (!isUdharRecentTransaction(tx)) continue
    const personId = personIdFromTransaction(tx)
    if (!personId) continue
    const rec = tx as unknown as Record<string, unknown>
    const ms = parseDateToMs(tx.date) ?? parseDateToMs(rec.createdAt ?? rec.created_at)
    if (ms == null) continue
    const prev = map.get(personId) ?? 0
    if (ms > prev) map.set(personId, ms)
  }
  return map
}

/** Prefer explicit API activity fields on the person; fall back to ledger index. */
export function getPersonLastUdharActivityMs(
  person: Person,
  activityIndex?: Map<string, number>
): number {
  const raw = person as Record<string, unknown>
  const apiCandidates = [
    raw.lastTransactionDate,
    raw.last_transaction_date,
    raw.lastUdharDate,
    raw.last_udhar_date,
    raw.lastUdharTransactionDate,
    raw.last_udhar_transaction_date,
    raw.latestTransactionDate,
    raw.latest_transaction_date,
    raw.lastActivityAt,
    raw.last_activity_at,
  ]
  for (const c of apiCandidates) {
    const ms = parseDateToMs(c)
    if (ms != null) return ms
  }
  return activityIndex?.get(String(person.id)) ?? 0
}

export function sortPeopleByRecentUdharActivity(
  people: Person[],
  activityIndex?: Map<string, number>
): Person[] {
  return [...people].sort((a, b) => {
    const diff =
      getPersonLastUdharActivityMs(b, activityIndex) -
      getPersonLastUdharActivityMs(a, activityIndex)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  })
}

export function filterPeopleBySearch(people: Person[], query: string): Person[] {
  const q = query.trim().toLowerCase()
  if (!q) return people
  const qDigits = q.replace(/\D/g, "")
  return people.filter((person) => {
    if (person.name.toLowerCase().includes(q)) return true
    const phone = getPersonDisplayPhone(person)
    if (!phone) return false
    const phoneLower = phone.toLowerCase()
    if (phoneLower.includes(q)) return true
    if (qDigits.length >= 3) {
      const phoneDigits = phone.replace(/\D/g, "")
      return phoneDigits.includes(qDigits)
    }
    return false
  })
}

export function orderPeopleForUdharDisplay(
  people: Person[],
  options?: {
    search?: string
    activityIndex?: Map<string, number>
  }
): Person[] {
  const filtered = filterPeopleBySearch(people, options?.search ?? "")
  return sortPeopleByRecentUdharActivity(filtered, options?.activityIndex)
}
