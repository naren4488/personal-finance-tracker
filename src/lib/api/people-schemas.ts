import { z } from "zod"

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

/** Parse numeric person fields from GET /people (signed or magnitude). */
export function parsePersonAmountField(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").replace(/\s/g, ""))
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

/** Signed INR from `person.totalBalance` (People list, detail). */
export function parsePersonTotalBalance(value: unknown): number {
  return parsePersonAmountField(value)
}

export type PersonUdharTotals = {
  totalBalance: number
  totalGiven: number
  totalTaken: number
  totalReceived: number
  totalPaid: number
}

/** Udhar summary fields from GET /people — single source of truth for display. */
export function getPersonUdharTotals(person: Person): PersonUdharTotals {
  return {
    totalBalance: parsePersonTotalBalance(person.totalBalance),
    totalGiven: parsePersonAmountField(person.totalGiven),
    totalTaken: parsePersonAmountField(person.totalTaken),
    totalReceived: parsePersonAmountField(person.totalReceived),
    totalPaid: parsePersonAmountField(person.totalPaid),
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
  return { ok: true, person: parsed.data.data.person }
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
  return { ok: true, data: parsed.data.data }
}
