import type { Account } from "@/lib/api/account-schemas"
import { accountSelectLabel } from "@/lib/api/account-schemas"
import {
  getRecentTransactionCategoryLabel,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import { formatDate } from "@/lib/format"
import {
  isKnownUdharTitleSlug,
  isUdharActionDisplayLabel,
  mapUdharTitleSlugToLabel,
} from "@/lib/transactions/transaction-udhar-title-labels"

export type TransactionRowFieldLabel =
  | "Date"
  | "Name"
  | "Account"
  | "Expense On"
  | "Person"
  | "Type"

export type TransactionRowLabeledLine = {
  label: TransactionRowFieldLabel
  value: string
}

export type TransactionRowDisplay = {
  lines: TransactionRowLabeledLine[]
}

export type TransactionRowDisplayOptions = {
  /** Resolve receiving/paying account name when the API only sends account ids. */
  accounts?: Account[]
}

function readApiString(rec: Record<string, unknown>, keys: readonly string[]): string {
  for (const k of keys) {
    const v = rec[k]
    if (typeof v === "string" && v.trim()) return v.trim()
  }
  return ""
}

function labeledLine(
  label: TransactionRowFieldLabel,
  value: string | null | undefined
): TransactionRowLabeledLine | null {
  const v = typeof value === "string" ? value.trim() : ""
  if (!v) return null
  return { label, value: v }
}

function mappedUdharActionFromSlugFields(rec: Record<string, unknown>): string | null {
  for (const key of [
    "entryType",
    "entry_type",
    "destinationType",
    "destination_type",
    "kind",
    "title",
  ] as const) {
    const raw = readApiString(rec, [key])
    const label = mapUdharTitleSlugToLabel(raw)
    if (label) return label
  }
  return null
}

/** Udhar action label from slug fields, or passthrough when API already humanized `title`. */
function resolveUdharActionLabel(rec: Record<string, unknown>, title: string): string | null {
  const fromSlug = mappedUdharActionFromSlugFields(rec)
  if (fromSlug) return fromSlug
  if (title && isUdharActionDisplayLabel(title)) return title.trim()
  return null
}

function isUdharTransactionRow(rec: Record<string, unknown>, title: string): boolean {
  if (mappedUdharActionFromSlugFields(rec)) return true
  if (title && isUdharActionDisplayLabel(title)) return true
  if (title && isKnownUdharTitleSlug(title)) return true
  const dest = readApiString(rec, ["destinationType", "destination_type"]).toLowerCase()
  if (dest.includes("person")) return true
  return false
}

const UDhar_ACCOUNT_SOURCE_KEYS = [
  "sourceName",
  "source_name",
  "accountName",
  "account_name",
  "fromAccountName",
  "from_account_name",
  "payFromAccountName",
  "pay_from_account_name",
] as const

const UDhar_ACCOUNT_DESTINATION_KEYS = [
  "destinationName",
  "destination_name",
  "toAccountName",
  "to_account_name",
] as const

function isSameDisplayLabel(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function isInvalidUdharAccountCandidate(value: string, personLine: string): boolean {
  if (!value.trim()) return true
  if (isKnownUdharTitleSlug(value) || isUdharActionDisplayLabel(value)) return true
  if (personLine && isSameDisplayLabel(value, personLine)) return true
  return false
}

function pickUdharAccountFromKeyGroups(
  rec: Record<string, unknown>,
  personLine: string,
  keyGroups: readonly (readonly string[])[]
): string {
  for (const keys of keyGroups) {
    const value = readApiString(rec, keys)
    if (!isInvalidUdharAccountCandidate(value, personLine)) return value
  }
  return ""
}

/** Account label for Udhar rows: real account name from API, never the person name. */
function readUdharAccountLine(tx: RecentTransaction, personLine: string): string {
  const rec = tx as unknown as Record<string, unknown>
  return pickUdharAccountFromKeyGroups(rec, personLine, [
    UDhar_ACCOUNT_SOURCE_KEYS,
    UDhar_ACCOUNT_DESTINATION_KEYS,
    ["subtitle"],
  ])
}

function compactLines(lines: Array<TransactionRowLabeledLine | null>): TransactionRowLabeledLine[] {
  return lines.filter((row): row is TransactionRowLabeledLine => row != null)
}

function toDisplayWords(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  if (/[A-Z]/.test(t)) return t
  return t
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function resolveAccountLabelById(accounts: Account[] | undefined, accountId: string): string {
  const id = accountId.trim()
  if (!id || !accounts?.length) return ""
  const match = accounts.find((a) => String(a.id) === id)
  return match ? accountSelectLabel(match) : ""
}

function isInvalidIncomeAccountCandidate(value: string, personLine: string): boolean {
  if (!value.trim()) return true
  if (isKnownUdharTitleSlug(value) || isUdharActionDisplayLabel(value)) return true
  if (personLine && isSameDisplayLabel(value, personLine)) return true
  return false
}

function readIncomeNameLine(title: string, incomeSource: string, category: string): string {
  const fromTitle =
    title && !isKnownUdharTitleSlug(title) && !isUdharActionDisplayLabel(title)
      ? toDisplayWords(title)
      : ""
  if (fromTitle) return fromTitle
  const fromIncomeSource = incomeSource ? toDisplayWords(incomeSource) : ""
  if (fromIncomeSource) return fromIncomeSource
  return category ? toDisplayWords(category) : ""
}

/** Receiving account for income (salary, bonus, interest, refund, etc.). */
function readIncomeAccountLine(
  rec: Record<string, unknown>,
  personLine: string,
  accounts?: Account[]
): string {
  const destinationName = readApiString(rec, ["destinationName", "destination_name"])
  const sourceName = readApiString(rec, ["sourceName", "source_name"])
  const subtitle = readApiString(rec, ["subtitle"])

  for (const candidate of [destinationName, sourceName, subtitle]) {
    if (!isInvalidIncomeAccountCandidate(candidate, personLine)) return candidate
  }

  const destinationAccountId = readApiString(rec, [
    "destinationAccountId",
    "destination_account_id",
    "toAccountId",
    "to_account_id",
  ])
  const fromLookupDest = resolveAccountLabelById(accounts, destinationAccountId)
  if (fromLookupDest) return fromLookupDest

  const accountId = readApiString(rec, ["accountId", "account_id"])
  return resolveAccountLabelById(accounts, accountId)
}

/**
 * Labeled list copy from API fields (+ fixed Udhar slug labels; optional account id lookup for income).
 */
export function getTransactionRowDisplayFields(
  tx: RecentTransaction,
  options?: TransactionRowDisplayOptions
): TransactionRowDisplay {
  const rec = tx as unknown as Record<string, unknown>
  const txType = String(tx.type ?? "")
    .trim()
    .toLowerCase()

  const personName = readApiString(rec, ["personName", "person_name", "counterpartyName"])
  const destinationName = readApiString(rec, ["destinationName", "destination_name"])
  const sourceName = readApiString(rec, ["sourceName", "source_name"])
  const subtitle = readApiString(rec, ["subtitle"])
  const title = readApiString(rec, ["title"])
  const category = getRecentTransactionCategoryLabel(tx)
  const incomeSource = readApiString(rec, ["incomeSource", "income_source"])
  const personId = readApiString(rec, ["personId", "person_id"])

  const dateValue = formatDate(tx.date)

  if (txType === "expense") {
    const expenseOn = title || getRecentTransactionCategoryLabel(tx)
    const showPerson = Boolean(personId.trim() || personName.trim())

    return {
      lines: compactLines([
        labeledLine("Date", dateValue),
        labeledLine("Expense On", expenseOn),
        labeledLine("Account", sourceName),
        showPerson ? labeledLine("Person", personName) : null,
      ]),
    }
  }

  if (isUdharTransactionRow(rec, title)) {
    const personForAccountDedupe = personName || destinationName || ""
    const account = readUdharAccountLine(tx, personForAccountDedupe)
    const name =
      personName ||
      (destinationName && !isSameDisplayLabel(destinationName, account) ? destinationName : "") ||
      (title &&
      !isUdharActionDisplayLabel(title) &&
      !isKnownUdharTitleSlug(title) &&
      !isSameDisplayLabel(title, account)
        ? title
        : "")
    const actionLabel = resolveUdharActionLabel(rec, title)

    return {
      lines: compactLines([
        labeledLine("Date", dateValue),
        labeledLine("Name", name),
        labeledLine("Account", account),
        labeledLine("Type", actionLabel),
      ]),
    }
  }

  if (txType === "income") {
    const nameValue = readIncomeNameLine(title, incomeSource, category)
    const accountValue = readIncomeAccountLine(rec, personName, options?.accounts)

    return {
      lines: compactLines([
        labeledLine("Date", dateValue),
        labeledLine("Name", nameValue),
        labeledLine("Account", accountValue),
      ]),
    }
  }

  if (txType === "transfer") {
    const typeValue = isKnownUdharTitleSlug(title) ? "" : title
    const accountValue = subtitle || sourceName

    return {
      lines: compactLines([
        labeledLine("Date", dateValue),
        labeledLine("Type", typeValue),
        labeledLine("Account", accountValue),
      ]),
    }
  }

  const nameValue = personName || destinationName
  const accountValue = sourceName || subtitle
  const typeValue =
    resolveUdharActionLabel(rec, title) ||
    (isKnownUdharTitleSlug(title) ? "" : title) ||
    mappedUdharActionFromSlugFields(rec) ||
    ""

  return {
    lines: compactLines([
      labeledLine("Date", dateValue),
      labeledLine("Name", nameValue),
      labeledLine("Account", accountValue),
      labeledLine("Type", typeValue),
    ]),
  }
}
