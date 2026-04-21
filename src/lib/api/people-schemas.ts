import { z } from "zod"
import { formatCurrency } from "@/lib/format"

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
 * Net balance for People list: prefers total lent vs taken when API sends them; else signed net.
 */
function computeNetFromPersonRaw(raw: Record<string, unknown>): {
  signedNet: number | null
  absAmount: number
  kind: PersonUdharBalanceType | "neutral"
} {
  const lentTotal = parseAmountish(
    raw.totalLent ?? raw.totalGiven ?? raw.moneyLent ?? raw.givenTotal
  )
  const borrowTotal = parseAmountish(
    raw.totalBorrowed ?? raw.totalTaken ?? raw.moneyBorrowed ?? raw.takenTotal
  )
  const hasPartials =
    raw.totalLent != null ||
    raw.totalGiven != null ||
    raw.totalBorrowed != null ||
    raw.totalTaken != null ||
    raw.moneyLent != null ||
    raw.moneyBorrowed != null

  if (hasPartials || lentTotal > 0 || borrowTotal > 0) {
    const net = lentTotal - borrowTotal
    const absAmount = Math.abs(net)
    if (net > 0) return { signedNet: net, absAmount, kind: "lent" }
    if (net < 0) return { signedNet: net, absAmount, kind: "borrowed" }
    return { signedNet: 0, absAmount: 0, kind: "neutral" }
  }

  /**
   * Backend contracts commonly include signed net fields.
   * Treat these as authoritative to avoid neutral/no-balance fallbacks on list rows.
   */
  const netAmountSigned = parseSignedRupee(raw.netAmount ?? raw.totalBalance ?? raw.total_balance)
  if (netAmountSigned !== null) {
    const absAmount = Math.abs(netAmountSigned)
    if (netAmountSigned > 0) return { signedNet: netAmountSigned, absAmount, kind: "lent" }
    if (netAmountSigned < 0) return { signedNet: netAmountSigned, absAmount, kind: "borrowed" }
    return { signedNet: 0, absAmount: 0, kind: "neutral" }
  }

  const typeRaw =
    typeof raw.type === "string"
      ? raw.type.trim().toLowerCase()
      : typeof raw.udharType === "string"
        ? raw.udharType.trim().toLowerCase()
        : ""
  let kind: PersonUdharBalanceType | "neutral" =
    typeRaw === "lent" || typeRaw === "receivable"
      ? "lent"
      : typeRaw === "borrowed" || typeRaw === "payable"
        ? "borrowed"
        : "neutral"

  let amount = parseAmountish(
    raw.balance ?? raw.udharBalance ?? raw.amount ?? raw.totalBalance ?? raw.total_balance
  )

  const signedCandidates = [
    raw.signedBalance,
    raw.netUdharAmount,
    raw.udharNet,
    raw.positionAmount,
    raw.totalBalance,
    raw.total_balance,
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

  if (kind === "lent") {
    return { signedNet: amount, absAmount: amount, kind: "lent" }
  }
  if (kind === "borrowed") {
    return { signedNet: -amount, absAmount: amount, kind: "borrowed" }
  }
  if (signed !== null && signed !== 0) {
    const abs = Math.abs(signed)
    return {
      signedNet: signed,
      absAmount: abs,
      kind: signed > 0 ? "lent" : "borrowed",
    }
  }
  if (amount > 0 && kind === "neutral") {
    return { signedNet: amount, absAmount: amount, kind: "neutral" }
  }
  return { signedNet: 0, absAmount: 0, kind: "neutral" }
}

export type PersonUdharListSummary = {
  kind: PersonUdharBalanceType | "neutral"
  /** Signed net in INR (positive = you’re owed / lent side; negative = you owe). */
  signedNet: number
  /** Absolute net for display magnitude. */
  absAmount: number
  /** Formatted magnitude (en-IN), e.g. ₹1,02,000. */
  netBalanceFormatted: string
  amount: number
  amountFormatted: string
  /** e.g. "You lent ₹X" | "You borrow ₹X" | "No balance due". */
  amountChipLabel: string
  directionLabel: string
  /** e.g. "You will get ₹X from this person." */
  summary: string
  badgeClassName: string
  amountTextClassName: string
}

/**
 * List + detail copy from ledger totals. `totalLent` / `totalBorrowed` are receivable vs payable
 * magnitudes from summed positive vs negative `signedAmount` values; `net === totalLent − totalBorrowed`.
 */
export function getPersonUdharListSummaryFromTotals(
  totalLent: number,
  totalBorrowed: number
): PersonUdharListSummary {
  const net = totalLent - totalBorrowed
  const absAmount = Math.abs(net)
  const amtStr = formatCurrency(absAmount)

  if (net > 0) {
    return {
      kind: "lent",
      signedNet: net,
      absAmount: net,
      netBalanceFormatted: amtStr,
      amount: net,
      amountFormatted: amtStr,
      amountChipLabel: `Receivable ${amtStr}`,
      directionLabel: "Receivable — positive signed amounts",
      summary: `You will get ${amtStr} from this person.`,
      badgeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      amountTextClassName: "text-emerald-600 dark:text-emerald-400",
    }
  }
  if (net < 0) {
    return {
      kind: "borrowed",
      signedNet: net,
      absAmount,
      netBalanceFormatted: amtStr,
      amount: absAmount,
      amountFormatted: amtStr,
      amountChipLabel: `Payable ${amtStr}`,
      directionLabel: "Payable — negative signed amounts",
      summary: `You owe ${amtStr} to this person.`,
      badgeClassName: "bg-red-500/15 text-red-700 dark:text-red-400",
      amountTextClassName: "text-red-600 dark:text-red-400",
    }
  }

  return {
    kind: "neutral",
    signedNet: 0,
    absAmount: 0,
    netBalanceFormatted: formatCurrency(0),
    amount: 0,
    amountFormatted: formatCurrency(0),
    amountChipLabel: "No balance due",
    directionLabel: "No activity",
    summary: "There is no net balance with this person.",
    badgeClassName: "bg-muted text-muted-foreground",
    amountTextClassName: "text-muted-foreground",
  }
}

/**
 * Summary for People list — net balance always shown (including ₹0); text labels instead of +/-.
 * Prefer {@link getPersonUdharListSummaryFromTotals} when batch udhar-summary is available.
 */
export function getPersonUdharListSummary(person: Person): PersonUdharListSummary {
  const raw = person as Record<string, unknown>
  const totalBalanceSigned = parseSignedRupee(raw.totalBalance ?? raw.total_balance)
  if (totalBalanceSigned !== null) {
    const absAmount = Math.abs(totalBalanceSigned)
    const netBalanceFormatted = formatCurrency(totalBalanceSigned)
    const amtStr = formatCurrency(absAmount)
    if (totalBalanceSigned > 0) {
      return {
        kind: "lent",
        signedNet: totalBalanceSigned,
        absAmount,
        netBalanceFormatted,
        amount: absAmount,
        amountFormatted: amtStr,
        amountChipLabel: `Net Balance ${netBalanceFormatted}`,
        directionLabel: "Receivable",
        summary: `Receivable amount is ${amtStr}.`,
        badgeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        amountTextClassName: "text-emerald-600 dark:text-emerald-400",
      }
    }
    if (totalBalanceSigned < 0) {
      return {
        kind: "borrowed",
        signedNet: totalBalanceSigned,
        absAmount,
        netBalanceFormatted,
        amount: absAmount,
        amountFormatted: amtStr,
        amountChipLabel: `Net Balance ${netBalanceFormatted}`,
        directionLabel: "Payable",
        summary: `Payable amount is ${amtStr}.`,
        badgeClassName: "bg-red-500/15 text-red-700 dark:text-red-400",
        amountTextClassName: "text-red-600 dark:text-red-400",
      }
    }
    return {
      kind: "neutral",
      signedNet: 0,
      absAmount: 0,
      netBalanceFormatted: formatCurrency(0),
      amount: 0,
      amountFormatted: formatCurrency(0),
      amountChipLabel: `Net Balance ${formatCurrency(0)}`,
      directionLabel: "No activity",
      summary: "There is no net balance with this person.",
      badgeClassName: "bg-muted text-muted-foreground",
      amountTextClassName: "text-muted-foreground",
    }
  }
  const { absAmount, kind } = computeNetFromPersonRaw(raw)
  const amtStr = formatCurrency(absAmount)
  const fallbackSignedNet = kind === "borrowed" ? -absAmount : absAmount
  const fallbackNet = formatCurrency(fallbackSignedNet)
  if (kind === "lent") {
    return {
      kind,
      signedNet: fallbackSignedNet,
      absAmount,
      netBalanceFormatted: fallbackNet,
      amount: absAmount,
      amountFormatted: amtStr,
      amountChipLabel: `Net Balance ${fallbackNet}`,
      directionLabel: "Receivable",
      summary: `Receivable amount is ${amtStr}.`,
      badgeClassName: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
      amountTextClassName: "text-emerald-600 dark:text-emerald-400",
    }
  }
  if (kind === "borrowed") {
    return {
      kind,
      signedNet: fallbackSignedNet,
      absAmount,
      netBalanceFormatted: fallbackNet,
      amount: absAmount,
      amountFormatted: amtStr,
      amountChipLabel: `Net Balance ${fallbackNet}`,
      directionLabel: "Payable",
      summary: `Payable amount is ${amtStr}.`,
      badgeClassName: "bg-red-500/15 text-red-700 dark:text-red-400",
      amountTextClassName: "text-red-600 dark:text-red-400",
    }
  }
  return {
    kind: "neutral",
    signedNet: 0,
    absAmount: 0,
    netBalanceFormatted: formatCurrency(0),
    amount: 0,
    amountFormatted: formatCurrency(0),
    amountChipLabel: `Net Balance ${formatCurrency(0)}`,
    directionLabel: "No activity",
    summary: "There is no net balance with this person.",
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
