import { z } from "zod"

function firstStringFromRecord(rec: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return ""
}

function idFromNestedRecord(raw: unknown): string {
  if (!raw || typeof raw !== "object") return ""
  return firstStringFromRecord(raw as Record<string, unknown>, ["id", "_id"])
}

/** Map snake_case / nested API shapes to the fields the UI expects. */
export function normalizeCommitmentRaw(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object") return null
  const rec = raw as Record<string, unknown>

  const personId =
    firstStringFromRecord(rec, ["personId", "person_id"]) ||
    idFromNestedRecord(rec.person) ||
    idFromNestedRecord(rec.linkedPerson) ||
    idFromNestedRecord(rec.udharPerson)

  const accountId =
    firstStringFromRecord(rec, [
      "accountId",
      "account_id",
      "creditCardAccountId",
      "credit_card_account_id",
      "loanAccountId",
      "loan_account_id",
      "linkedAccountId",
      "linked_account_id",
    ]) ||
    idFromNestedRecord(rec.account) ||
    idFromNestedRecord(rec.linkedAccount) ||
    idFromNestedRecord(rec.creditCard) ||
    idFromNestedRecord(rec.loan)

  const dueDate = firstStringFromRecord(rec, ["dueDate", "due_date"])
  const transactionId = firstStringFromRecord(rec, ["transactionId", "transaction_id"])
  const createdAt = firstStringFromRecord(rec, ["createdAt", "created_at"])

  return {
    ...rec,
    ...(personId ? { personId } : {}),
    ...(accountId ? { accountId } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(transactionId ? { transactionId } : {}),
    ...(createdAt ? { createdAt } : {}),
  }
}

/** Resolved ids for navigation and cache patches (post-normalization). */
export function getCommitmentLinkedIds(commitment: Commitment): {
  personId: string
  accountId: string
  transactionId: string
} {
  const rec = commitment as Record<string, unknown>
  return {
    personId: firstStringFromRecord(rec, ["personId", "person_id"]),
    accountId: firstStringFromRecord(rec, [
      "accountId",
      "account_id",
      "creditCardAccountId",
      "credit_card_account_id",
      "loanAccountId",
      "loan_account_id",
    ]),
    transactionId: firstStringFromRecord(rec, ["transactionId", "transaction_id"]),
  }
}

/** Drop commitments tied to a deleted account (optimistic cache trim before refetch).
 *
 * Deleted-entity policy (matches backend cascade expectation):
 * - When an account/loan/card/person is deleted, linked commitments are removed from the
 *   Analytics list cache immediately and GET /commitments is refetched.
 * - If the API briefly returns an orphan row (entity gone, commitment still pending),
 *   the row may still appear until refetch; row click shows a toast instead of navigating.
 */
export function filterCommitmentsAfterAccountDelete(
  commitments: Commitment[],
  accountId: string
): Commitment[] {
  const id = accountId.trim()
  if (!id) return commitments
  return commitments.filter((c) => getCommitmentLinkedIds(c).accountId !== id)
}

/** Drop commitments tied to a deleted person (optimistic cache trim before refetch). */
export function filterCommitmentsAfterPersonDelete(
  commitments: Commitment[],
  personId: string
): Commitment[] {
  const id = personId.trim()
  if (!id) return commitments
  return commitments.filter((c) => getCommitmentLinkedIds(c).personId !== id)
}

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
    transactionId: z.coerce.string().optional(),
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
  /** Required for payable; omitted for incoming. */
  status?: string
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
  personId?: string
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
  }
  const status = input.status?.trim()
  if (status) body.status = status
  const note = input.note?.trim()
  if (note) body.note = note
  const aid = input.accountId?.trim()
  if (aid) body.accountId = aid
  const pid = input.personId?.trim()
  if (pid) body.personId = pid
  return body
}

function parseCommitmentRow(raw: unknown): Commitment | null {
  const normalized = normalizeCommitmentRaw(raw)
  if (!normalized) return null
  const p = commitmentCoreSchema.safeParse(normalized)
  if (p.success) return p.data

  const rec = normalized
  const id = firstStringFromRecord(rec, ["id", "_id"])
  if (!id) return null

  return {
    ...rec,
    id,
    direction: firstStringFromRecord(rec, ["direction"]) || "payable",
    kind: firstStringFromRecord(rec, ["kind"]) || "other",
    title: firstStringFromRecord(rec, ["title"]) || "Commitment",
    amount: rec.amount ?? "0",
    dueDate: firstStringFromRecord(rec, ["dueDate", "due_date"]),
    status: firstStringFromRecord(rec, ["status"]) || "pending",
    personId: firstStringFromRecord(rec, ["personId", "person_id"]) || undefined,
    accountId: firstStringFromRecord(rec, ["accountId", "account_id"]) || undefined,
    note: firstStringFromRecord(rec, ["note"]) || undefined,
  } as Commitment
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
