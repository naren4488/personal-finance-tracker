import { z } from "zod"
import { parseInrFromUnknownStripSpaces } from "@/lib/money/parse-inr"

export const createPersonRequestSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phoneNumber: z.string().optional(),
})

export type CreatePersonRequest = z.infer<typeof createPersonRequestSchema>

export const personSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    phoneNumber: z.string().optional().default(""),
    isActive: z.boolean().optional().default(true),
    createdAt: z.string().optional().default(""),
    updatedAt: z.string().optional().default(""),
    totalBalance: z.union([z.number(), z.string()]).optional(),
    totalGiven: z.union([z.number(), z.string()]).optional(),
    totalTaken: z.union([z.number(), z.string()]).optional(),
    totalReceived: z.union([z.number(), z.string()]).optional(),
    totalPaid: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()

export type Person = z.infer<typeof personSchema>

const PERSON_NESTED_TOTALS_KEYS = [
  "udhar",
  "udharTotals",
  "udhar_totals",
  "balances",
  "balance",
  "summary",
  "totals",
] as const

function personAmountSources(person: Person): Record<string, unknown>[] {
  const raw = person as Record<string, unknown>
  const sources: Record<string, unknown>[] = [raw]
  for (const key of PERSON_NESTED_TOTALS_KEYS) {
    const nested = raw[key]
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      sources.push(nested as Record<string, unknown>)
    }
  }
  return sources
}

/** Parse numeric person fields from GET /people (signed or magnitude). */
export function parsePersonAmountField(value: unknown): number {
  return parseInrFromUnknownStripSpaces(value)
}

/** Signed INR from `person.totalBalance` (People list, detail). */
export function parsePersonTotalBalance(value: unknown): number {
  return parsePersonAmountField(value)
}

function readPersonApiAmount(person: Person, keys: readonly string[]): number {
  for (const src of personAmountSources(person)) {
    for (const key of keys) {
      const value = src[key]
      if (value !== undefined && value !== null) {
        return parsePersonAmountField(value)
      }
    }
  }
  return 0
}

export type PersonUdharTotals = {
  totalBalance: number
  totalGiven: number
  totalTaken: number
  totalReceived: number
  totalPaid: number
}

/**
 * Udhar summary fields from GET /people — backend is the source of truth.
 * Reads camelCase, snake_case, and nested balance objects; never derives from ledger.
 */
export function getPersonUdharTotals(person: Person): PersonUdharTotals {
  return {
    totalBalance: readPersonApiAmount(person, [
      "totalBalance",
      "total_balance",
      "netBalance",
      "net_balance",
      "net",
      "balance",
    ]),
    totalGiven: readPersonApiAmount(person, [
      "totalGiven",
      "total_given",
      "givenTotal",
      "given_total",
    ]),
    totalTaken: readPersonApiAmount(person, [
      "totalTaken",
      "total_taken",
      "takenTotal",
      "taken_total",
    ]),
    totalReceived: readPersonApiAmount(person, [
      "totalReceived",
      "total_received",
      "paymentsReceived",
      "payments_received",
    ]),
    totalPaid: readPersonApiAmount(person, [
      "totalPaid",
      "total_paid",
      "paymentsMade",
      "payments_made",
    ]),
  }
}

/** Flatten API totals onto canonical Person fields after parse. */
export function normalizePersonRecord(person: Person): Person {
  const totals = getPersonUdharTotals(person)
  return {
    ...person,
    totalBalance: totals.totalBalance,
    totalGiven: totals.totalGiven,
    totalTaken: totals.totalTaken,
    totalReceived: totals.totalReceived,
    totalPaid: totals.totalPaid,
  }
}

/** Phone from `phoneNumber` or alternate `phone` key. */
export function getPersonDisplayPhone(person: Person): string | undefined {
  const from = person.phoneNumber?.trim()
  if (from) return from
  const raw = person as Record<string, unknown>
  const alt = raw.phone
  if (typeof alt === "string" && alt.trim()) return alt.trim()
  return undefined
}

export const createPersonSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    person: personSchema,
  }),
})

export function parseCreatePersonSuccess(
  raw: unknown
): { ok: true; person: Person } | { ok: false; error: string } {
  const parsed = createPersonSuccessResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid response from server." }
  }
  return { ok: true, person: normalizePersonRecord(parsed.data.data.person) }
}

export const getPeopleSuccessResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
  data: z.object({
    people: z.array(personSchema),
  }),
})

export type GetPeopleSuccessData = z.infer<typeof getPeopleSuccessResponseSchema>["data"]

export function parseGetPeopleSuccess(
  raw: unknown
): { ok: true; data: GetPeopleSuccessData } | { ok: false; error: string } {
  const parsed = getPeopleSuccessResponseSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: "Invalid response from server." }
  }
  return {
    ok: true,
    data: {
      people: parsed.data.data.people.map(normalizePersonRecord),
    },
  }
}
