import type { Person } from "@/lib/api/people-schemas"

export type PersonDeleteTarget = { mode: "account"; id: string } | { mode: "person"; id: string }

/**
 * Backend may attach an account id that must be deleted via `DELETE /accounts/:id`
 * (e.g. udhar wallet). Otherwise delete the person with `DELETE /people/:id`.
 */
export function resolvePersonDeleteTarget(person: Person): PersonDeleteTarget {
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

/** Confirmation dialog copy — reflects whether delete removes a person or udhar account. */
export function getPersonDeleteConfirmCopy(
  person: Person,
  target: PersonDeleteTarget = resolvePersonDeleteTarget(person)
): { title: string; message: string } {
  const name = person.name?.trim()

  if (target.mode === "account") {
    return {
      title: "Delete Udhar Account",
      message: name
        ? `Are you sure you want to delete the udhar account "${name}"?`
        : "Are you sure you want to delete this udhar account?",
    }
  }

  return {
    title: "Delete Person",
    message: name
      ? `Are you sure you want to delete "${name}"?`
      : "Are you sure you want to delete this person?",
  }
}
