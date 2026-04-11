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
  })
  .passthrough()

export type Person = z.infer<typeof personSchema>

/** Optional fields some list endpoints return for Udhar summary. */
export type PersonUdharBalanceType = "lent" | "borrowed"

function parseAmountish(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.abs(v)
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").replace(/\s/g, ""))
    return Number.isFinite(n) ? Math.abs(n) : 0
  }
  return 0
}

/** Parse signed rupee amount; used when API sends one net number instead of type + abs(balance). */
function parseSignedRupee(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string") {
    const n = Number(v.replace(/,/g, "").replace(/\s/g, ""))
    return Number.isFinite(n) ? n : null
  }
  return null
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

/**
 * Summary for People list: lent → "You will get ₹X", borrowed → "You owe ₹X".
 * Reads optional `balance` / `type` (or `udharType`) from API; falls back to neutral.
 */
export function getPersonUdharListSummary(person: Person): {
  kind: PersonUdharBalanceType | "neutral"
  amount: number
  /** e.g. ₹1,250 */
  amountFormatted: string
  /** Right chip: "You get ₹X" / "You owe ₹X" (design reference). */
  amountChipLabel: string
  /** Short English line (optional; design uses summary line instead). */
  directionLabel: string
  summary: string
  badgeClassName: string
  amountTextClassName: string
} {
  const raw = person as Record<string, unknown>
  const typeRaw =
    typeof raw.type === "string"
      ? raw.type.trim().toLowerCase()
      : typeof raw.udharType === "string"
        ? raw.udharType.trim().toLowerCase()
        : ""
  let kind: PersonUdharBalanceType | "neutral" =
    typeRaw === "lent" || typeRaw === "borrowed" ? typeRaw : "neutral"

  let amount = parseAmountish(raw.balance ?? raw.udharBalance ?? raw.amount)

  // Many backends send a single signed net (positive = they owe you / lent, negative = you owe / borrowed).
  const signedCandidates = [
    raw.signedBalance,
    raw.netUdharAmount,
    raw.netAmount,
    raw.udharNet,
    raw.positionAmount,
  ] as const
  let signed: number | null = null
  for (const c of signedCandidates) {
    const p = parseSignedRupee(c)
    if (p !== null) {
      signed = p
      break
    }
  }

  if (kind === "neutral" && signed !== null && signed !== 0) {
    kind = signed > 0 ? "lent" : "borrowed"
    amount = Math.abs(signed)
  } else if (kind !== "neutral" && amount === 0 && signed !== null) {
    amount = Math.abs(signed)
  }

  const formatted = `₹${amount.toLocaleString("en-IN")}`
  if (kind === "lent") {
    return {
      kind: "lent",
      amount,
      amountFormatted: formatted,
      amountChipLabel: `You get ${formatted}`,
      directionLabel: "You lent — you'll get this back",
      summary: `You will get ${formatted} from this person.`,
      badgeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      amountTextClassName: "text-emerald-600 dark:text-emerald-400",
    }
  }
  if (kind === "borrowed") {
    return {
      kind: "borrowed",
      amount,
      amountFormatted: formatted,
      amountChipLabel: `You owe ${formatted}`,
      directionLabel: "You borrowed — you need to repay",
      summary: `You owe ${formatted} to this person.`,
      badgeClassName: "bg-red-500/15 text-red-700 dark:text-red-400",
      amountTextClassName: "text-red-600 dark:text-red-400",
    }
  }
  return {
    kind: "neutral",
    amount,
    amountFormatted: amount > 0 ? formatted : "—",
    amountChipLabel: amount > 0 ? formatted : "—",
    directionLabel: amount > 0 ? "Outstanding balance" : "No open balance",
    summary: amount > 0 ? `Balance ${formatted}` : "No open balance for this account.",
    badgeClassName: "bg-muted text-muted-foreground",
    amountTextClassName: "text-muted-foreground",
  }
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
