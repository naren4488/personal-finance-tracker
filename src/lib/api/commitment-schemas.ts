import { z } from "zod"

const commitmentCoreSchema = z
  .object({
    id: z.coerce.string(),
    direction: z.coerce.string(),
    kind: z.coerce.string(),
    title: z.coerce.string(),
    amount: z.union([z.string(), z.number()]),
    dueDate: z.coerce.string(),
    status: z.coerce.string(),
    personId: z.coerce.string().optional(),
    accountId: z.coerce.string().optional(),
    note: z.coerce.string().optional(),
    createdAt: z.coerce.string().optional(),
    updatedAt: z.coerce.string().optional(),
  })
  .passthrough()

export type Commitment = z.infer<typeof commitmentCoreSchema>

export type CreateCommitmentRequest = {
  direction: string
  kind: string
  title: string
  /** API expects string amounts, e.g. `"31000"` */
  amount: string
  /** ISO date `YYYY-MM-DD` */
  dueDate: string
  status: string
  accountId?: string
  note?: string
  personId?: string
}

function normalizeAmountString(raw: string): string {
  const n = Number(String(raw).replace(/[^\d.]/g, ""))
  if (!Number.isFinite(n) || n <= 0) return ""
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 100) / 100)
}

export function buildCreateCommitmentBody(input: {
  direction: string
  kind: string
  title: string
  amountInput: string
  dueDate: string
  status?: string
  accountId?: string
  note?: string
}): CreateCommitmentRequest {
  const amount = normalizeAmountString(input.amountInput)
  if (!amount) {
    throw new Error("Invalid amount")
  }
  const body: CreateCommitmentRequest = {
    direction: input.direction.trim(),
    kind: input.kind.trim(),
    title: input.title.trim(),
    amount,
    dueDate: input.dueDate.trim(),
    status: (input.status ?? "pending").trim(),
  }
  const note = input.note?.trim()
  if (note) body.note = note
  const aid = input.accountId?.trim()
  if (aid) body.accountId = aid
  return body
}

function parseCommitmentRow(raw: unknown): Commitment | null {
  const p = commitmentCoreSchema.safeParse(raw)
  return p.success ? p.data : null
}

export function parseCreateCommitmentSuccess(
  data: unknown
): { ok: true; commitment: Commitment; message?: string } | { ok: false; error: string } {
  if (data === null || typeof data !== "object") {
    return { ok: false, error: "Invalid create commitment response." }
  }
  const root = data as Record<string, unknown>
  const inner = root.data
  const payload = inner !== undefined && inner !== null && typeof inner === "object" ? inner : root
  const p = payload as Record<string, unknown>
  const c = p.commitment ?? p.data
  const row = parseCommitmentRow(c)
  if (!row) {
    return { ok: false, error: "Invalid commitment in response." }
  }
  const msg = typeof root.message === "string" ? root.message : undefined
  return { ok: true, commitment: row, message: msg }
}

export function parseGetCommitmentsSuccess(
  data: unknown
): { ok: true; commitments: Commitment[] } | { ok: false; error: string } {
  if (data === null || typeof data !== "object") {
    return { ok: false, error: "Invalid commitments response." }
  }
  const root = data as Record<string, unknown>
  const inner = root.data
  const payload =
    inner !== undefined && inner !== null && typeof inner === "object"
      ? (inner as Record<string, unknown>)
      : root
  const rawList = payload.commitments ?? payload.items ?? payload.list
  if (!Array.isArray(rawList)) {
    return { ok: false, error: "Invalid commitments list." }
  }
  const out: Commitment[] = []
  for (const r of rawList) {
    const row = parseCommitmentRow(r)
    if (row) out.push(row)
  }
  return { ok: true, commitments: out }
}

export type GetCommitmentsQueryArg = {
  direction?: string
  status?: string
}
