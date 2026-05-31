import type { Account } from "@/lib/api/account-schemas"
import {
  accountSelectLabel,
  filterActiveAccounts,
  filterNormalAccounts,
} from "@/lib/api/account-schemas"
import type { Commitment, CreateCommitmentRequest } from "@/lib/api/commitment-schemas"
import { buildCreateCommitmentBody, getCommitmentLinkedIds } from "@/lib/api/commitment-schemas"
import type { Person } from "@/lib/api/people-schemas"

/** Wire values sent to POST /commitments */
export const COMMITMENT_KIND_VALUES = [
  "card_bill",
  "loan_emi",
  "person_due",
  "person_receivable",
  "client_payment",
  "upcoming_expense",
  "salary",
  "refund",
  "other",
] as const

export type CommitmentKindValue = (typeof COMMITMENT_KIND_VALUES)[number]

export type CommitmentDirection = "payable" | "incoming"

export const PAYABLE_COMMITMENT_STATUSES = ["pending", "settled", "canceled"] as const
export type PayableCommitmentStatus = (typeof PAYABLE_COMMITMENT_STATUSES)[number]

export type EntitySource = "people" | "loans" | "credit_cards" | "normal_accounts"

export type EntityBinding =
  | { field: "none" }
  | {
      field: "personId"
      source: "people"
      required: boolean
      selectLabel: string
      placeholder: string
    }
  | {
      field: "accountId"
      source: Exclude<EntitySource, "people">
      required: boolean
      selectLabel: string
      placeholder: string
    }

export type CommitmentKindDef = {
  value: CommitmentKindValue
  label: string
  entity: EntityBinding
  defaultDirection: CommitmentDirection
  /** Optional helper under entity select */
  entityHint?: string
}

export const COMMITMENT_KIND_DEFINITIONS: readonly CommitmentKindDef[] = [
  {
    value: "card_bill",
    label: "Credit card bill",
    defaultDirection: "payable",
    entity: {
      field: "accountId",
      source: "credit_cards",
      required: true,
      selectLabel: "Select card",
      placeholder: "Select card",
    },
  },
  {
    value: "loan_emi",
    label: "Loan EMI",
    defaultDirection: "payable",
    entity: {
      field: "accountId",
      source: "loans",
      required: true,
      selectLabel: "Select loan",
      placeholder: "Select loan",
    },
  },
  {
    value: "person_due",
    label: "Udhar (payable)",
    defaultDirection: "payable",
    entity: {
      field: "personId",
      source: "people",
      required: true,
      selectLabel: "Select person",
      placeholder: "Select person",
    },
  },
  {
    value: "person_receivable",
    label: "Udhar (receivable)",
    defaultDirection: "incoming",
    entity: {
      field: "personId",
      source: "people",
      required: true,
      selectLabel: "Select person",
      placeholder: "Select person",
    },
  },
  {
    value: "client_payment",
    label: "Client payment",
    defaultDirection: "incoming",
    entity: {
      field: "personId",
      source: "people",
      required: true,
      selectLabel: "Select client",
      placeholder: "Select person",
    },
  },
  {
    value: "upcoming_expense",
    label: "Upcoming expense",
    defaultDirection: "payable",
    entity: {
      field: "accountId",
      source: "normal_accounts",
      required: true,
      selectLabel: "Select account",
      placeholder: "Select account",
    },
  },
  {
    value: "salary",
    label: "Salary",
    defaultDirection: "incoming",
    entity: {
      field: "accountId",
      source: "normal_accounts",
      required: true,
      selectLabel: "Select account",
      placeholder: "Select account",
    },
    entityHint: "Account where salary is deposited.",
  },
  {
    value: "refund",
    label: "Refund",
    defaultDirection: "incoming",
    entity: {
      field: "accountId",
      source: "normal_accounts",
      required: false,
      selectLabel: "Select account",
      placeholder: "Optional account",
    },
    entityHint: "Optional — link an account if this refund lands in a specific wallet.",
  },
  {
    value: "other",
    label: "Other",
    defaultDirection: "payable",
    entity: { field: "none" },
  },
] as const

/** Max height for commitments list (~5–6 rows). */
export const COMMITMENTS_LIST_MAX_HEIGHT_CLASS = "max-h-[min(22rem,45vh)]"

const KIND_ALIASES: Record<string, CommitmentKindValue> = {
  loan: "loan_emi",
  emi: "loan_emi",
  card: "card_bill",
  credit_card: "card_bill",
  person: "person_due",
  person_borrow: "person_due",
  person_payable: "person_due",
  udhar: "person_due",
  udhar_borrow: "person_due",
  person_lent: "person_receivable",
  person_receivable: "person_receivable",
}

export function normalizeCommitmentKind(kind: string): string {
  return kind.trim().toLowerCase()
}

export function getCommitmentKindDef(kind: string): CommitmentKindDef {
  const k = normalizeCommitmentKind(kind)
  const alias = KIND_ALIASES[k]
  if (alias) {
    const found = COMMITMENT_KIND_DEFINITIONS.find((d) => d.value === alias)
    if (found) return found
  }
  const exact = COMMITMENT_KIND_DEFINITIONS.find((d) => d.value === k)
  if (exact) return exact
  if (k.includes("card") || k.includes("credit")) {
    return COMMITMENT_KIND_DEFINITIONS.find((d) => d.value === "card_bill")!
  }
  if (k.includes("loan") || k.includes("emi")) {
    return COMMITMENT_KIND_DEFINITIONS.find((d) => d.value === "loan_emi")!
  }
  if (k.startsWith("person_") || k.includes("udhar") || k.includes("client")) {
    if (k.includes("receiv") || k.includes("lent") || k.includes("client")) {
      return COMMITMENT_KIND_DEFINITIONS.find((d) => d.value === "person_receivable")!
    }
    return COMMITMENT_KIND_DEFINITIONS.find((d) => d.value === "person_due")!
  }
  return COMMITMENT_KIND_DEFINITIONS.find((d) => d.value === "other")!
}

export function commitmentKindNeedsEntity(kind: string): boolean {
  const def = getCommitmentKindDef(kind)
  return def.entity.field !== "none"
}

export type EntitySelectOption = { id: string; label: string }

export type EntityCatalog = {
  people: Person[]
  loans: Account[]
  creditCards: Account[]
  normalAccounts: Account[]
  /** Known transaction ids for deleted-entity checks on row click. */
  transactions: { id: string }[]
}

export function buildEntityCatalog(input: {
  people: Person[]
  loans: Account[]
  creditCards: Account[]
  allAccounts: Account[]
  transactions?: { id: string }[]
}): EntityCatalog {
  return {
    people: input.people.filter((p) => p.isActive !== false),
    loans: filterActiveAccounts(input.loans),
    creditCards: filterActiveAccounts(input.creditCards),
    normalAccounts: filterActiveAccounts(filterNormalAccounts(input.allAccounts)),
    transactions: input.transactions ?? [],
  }
}

export function personSelectLabel(person: Person): string {
  const name = person.name?.trim() || "Person"
  const phone = person.phoneNumber?.trim()
  return phone ? `${name} · ${phone}` : name
}

export function getEntityOptionsForKind(
  kind: CommitmentKindValue | string,
  catalog: EntityCatalog
): EntitySelectOption[] {
  const def = getCommitmentKindDef(kind)
  if (def.entity.field === "none") return []

  if (def.entity.field === "personId") {
    return catalog.people.map((p) => ({
      id: String(p.id),
      label: personSelectLabel(p),
    }))
  }

  const source = def.entity.source
  const accounts =
    source === "loans"
      ? catalog.loans
      : source === "credit_cards"
        ? catalog.creditCards
        : catalog.normalAccounts

  return accounts.map((a) => ({
    id: String(a.id),
    label: accountSelectLabel(a),
  }))
}

export function validateCommitmentEntity(
  kind: CommitmentKindValue | string,
  entityId: string
): string | null {
  const def = getCommitmentKindDef(kind)
  if (def.entity.field === "none") return null
  if (!def.entity.required) return null
  if (!entityId.trim()) return def.entity.selectLabel
  return null
}

export function buildCommitmentCreatePayload(input: {
  direction: CommitmentDirection
  kind: CommitmentKindValue
  title: string
  amountInput: string
  dueDate: string
  status?: string
  entityId: string
  note: string
}): CreateCommitmentRequest {
  const def = getCommitmentKindDef(input.kind)
  const entityId = input.entityId.trim()

  return buildCreateCommitmentBody({
    direction: input.direction,
    kind: input.kind,
    title: input.title,
    amountInput: input.amountInput,
    dueDate: input.dueDate,
    status: input.direction === "payable" ? (input.status ?? "pending") : undefined,
    note: input.note,
    accountId: def.entity.field === "accountId" && entityId ? entityId : undefined,
    personId: def.entity.field === "personId" && entityId ? entityId : undefined,
  })
}

const PERSON_LINKED_ACCOUNT_KEYS = [
  "linkedAccountId",
  "deletableAccountId",
  "udharAccountId",
  "linked_account_id",
  "deletable_account_id",
  "udhar_account_id",
] as const

function personIdForLinkedAccount(accountId: string, people: Person[]): string {
  const aid = accountId.trim()
  if (!aid) return ""
  for (const p of people) {
    const raw = p as Record<string, unknown>
    for (const k of PERSON_LINKED_ACCOUNT_KEYS) {
      if (String(raw[k] ?? "").trim() === aid) return String(p.id).trim()
    }
  }
  return ""
}

function isCardLikeKind(kind: string): boolean {
  const k = normalizeCommitmentKind(kind)
  return (
    k.includes("card_bill") ||
    k.includes("credit_card") ||
    (k.includes("card") && !k.includes("discard")) ||
    k === "card"
  )
}

function isLoanLikeKind(kind: string): boolean {
  const k = normalizeCommitmentKind(kind)
  return k.includes("loan") || k.includes("emi")
}

function accountNavigationTarget(kind: string, accountId: string): CommitmentNavigationTarget {
  const def = getCommitmentKindDef(kind)
  if (def.entity.field === "accountId") {
    if (def.entity.source === "credit_cards") {
      return {
        path: `/cards/${encodeURIComponent(accountId)}`,
        label: "View card",
      }
    }
    if (def.entity.source === "loans") {
      return {
        path: `/loans/${encodeURIComponent(accountId)}`,
        label: "View loan",
      }
    }
    return {
      path: `/accounts/${encodeURIComponent(accountId)}`,
      label: "View account",
    }
  }
  if (isCardLikeKind(kind)) {
    return {
      path: `/cards/${encodeURIComponent(accountId)}`,
      label: "View card",
    }
  }
  if (isLoanLikeKind(kind)) {
    return {
      path: `/loans/${encodeURIComponent(accountId)}`,
      label: "View loan",
    }
  }
  return {
    path: `/accounts/${encodeURIComponent(accountId)}`,
    label: "View account",
  }
}

export type CommitmentNavigationTarget = {
  path: string
  label: string
}

export function resolveCommitmentNavigationTarget(
  commitment: Commitment,
  catalog?: EntityCatalog
): CommitmentNavigationTarget | null {
  const kind = String(commitment.kind ?? "")
  const { personId, accountId } = getCommitmentLinkedIds(commitment)

  if (personId) {
    return {
      path: `/people/${encodeURIComponent(personId)}`,
      label: "View person",
    }
  }

  if (!accountId) return null

  const def = getCommitmentKindDef(kind)
  if (def.entity.field === "personId") {
    const linkedPersonId = catalog ? personIdForLinkedAccount(accountId, catalog.people) : ""
    if (linkedPersonId) {
      return {
        path: `/people/${encodeURIComponent(linkedPersonId)}`,
        label: "View person",
      }
    }
  }

  return accountNavigationTarget(kind, accountId)
}

export function commitmentEntityLinkLabel(
  commitment: Commitment,
  catalog?: EntityCatalog
): string | null {
  const nav = resolveCommitmentNavigationTarget(commitment, catalog)
  if (!nav) return null

  const { personId, accountId } = getCommitmentLinkedIds(commitment)

  if (personId && catalog) {
    const p = catalog.people.find((x) => String(x.id) === personId)
    if (p) return personSelectLabel(p)
  }

  if (accountId && catalog) {
    const linkedPersonId = personIdForLinkedAccount(accountId, catalog.people)
    if (linkedPersonId) {
      const p = catalog.people.find((x) => String(x.id) === linkedPersonId)
      if (p) return personSelectLabel(p)
    }
    const all = [...catalog.creditCards, ...catalog.loans, ...catalog.normalAccounts]
    const a = all.find((x) => String(x.id) === accountId)
    if (a) return accountSelectLabel(a)
  }

  return getCommitmentKindDef(String(commitment.kind ?? "")).label
}

export type CommitmentRowAction =
  | { type: "navigate"; path: string; label: string }
  | { type: "toast"; message: string }
  | { type: "none" }

/**
 * Row click behavior for Analytics → Commitments.
 * Verifies linked entity exists in the live catalog before navigating.
 */
export function resolveCommitmentRowAction(
  commitment: Commitment,
  catalog?: EntityCatalog
): CommitmentRowAction {
  const nav = resolveCommitmentNavigationTarget(commitment, catalog)
  if (!nav) return { type: "none" }

  if (!catalog) {
    return { type: "navigate", path: nav.path, label: nav.label }
  }

  const { personId, accountId, transactionId } = getCommitmentLinkedIds(commitment)

  if (transactionId && catalog.transactions.length > 0) {
    const txExists = catalog.transactions.some((t) => String(t.id) === transactionId)
    if (!txExists) {
      return { type: "toast", message: "This transaction has been deleted." }
    }
  }

  if (personId) {
    if (catalog.people.some((p) => String(p.id) === personId)) {
      return { type: "navigate", path: nav.path, label: nav.label }
    }
    return { type: "toast", message: "This person has been deleted." }
  }

  if (nav.path.startsWith("/people/")) {
    const pid = decodeURIComponent(nav.path.replace(/^\/people\//, ""))
    if (catalog.people.some((p) => String(p.id) === pid)) {
      return { type: "navigate", path: nav.path, label: nav.label }
    }
    return { type: "toast", message: "This person has been deleted." }
  }

  if (!accountId) {
    return { type: "navigate", path: nav.path, label: nav.label }
  }

  if (nav.path.startsWith("/cards/")) {
    if (catalog.creditCards.some((a) => String(a.id) === accountId)) {
      return { type: "navigate", path: nav.path, label: nav.label }
    }
    return { type: "toast", message: "This credit card has been deleted." }
  }

  if (nav.path.startsWith("/loans/")) {
    if (catalog.loans.some((a) => String(a.id) === accountId)) {
      return { type: "navigate", path: nav.path, label: nav.label }
    }
    return { type: "toast", message: "This loan has been deleted." }
  }

  if (nav.path.startsWith("/accounts/")) {
    if (catalog.normalAccounts.some((a) => String(a.id) === accountId)) {
      return { type: "navigate", path: nav.path, label: nav.label }
    }
    return { type: "toast", message: "This account has been deleted." }
  }

  return { type: "navigate", path: nav.path, label: nav.label }
}
