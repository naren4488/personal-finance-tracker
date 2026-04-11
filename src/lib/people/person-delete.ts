import type { Person } from "@/lib/api/people-schemas"

/**
 * Backend may attach an account id that must be deleted via `DELETE /accounts/:id`
 * (e.g. udhar wallet). Otherwise delete the person with `DELETE /people/:id`.
 */
export function resolvePersonDeleteTarget(
  person: Person
): { mode: "account"; id: string } | { mode: "person"; id: string } {
  const raw = person as Record<string, unknown>
  const keys = ["linkedAccountId", "deletableAccountId", "udharAccountId"] as const
  for (const k of keys) {
    const v = raw[k]
    if (typeof v === "string" && v.trim()) {
      return { mode: "account", id: v.trim() }
    }
  }
  return { mode: "person", id: String(person.id).trim() }
}
