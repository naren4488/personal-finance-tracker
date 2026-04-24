import { formatDate } from "@/lib/format"
import type { Account } from "@/lib/api/account-schemas"
import {
  getRecentTransactionCategoryLabel,
  inferUdharPersonName,
  isUdharRecentTransaction,
  getTransferRouteLabels,
  sanitizeUserFacingApiText,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"
import { extractUdharEntryType } from "@/lib/udhar/udhar-effect"

/** Primary row title for Udhar / person-linked flows (matches ledger vocabulary). */
export function getUdharFlowPrimaryTitle(tx: RecentTransaction): string | null {
  const t = extractUdharEntryType(tx)
  switch (t) {
    case "money_given":
      return "Money Given"
    case "money_taken":
      return "Money Taken"
    case "payment_received":
      return "Payment Received"
    case "payment_made":
      return "Payment Made"
    default:
      return null
  }
}

function resolveExpenseIncomeAccountLabel(tx: RecentTransaction, accounts: Account[]): string {
  const src = tx.sourceName?.trim()
  if (src) return src
  const id = tx.accountId?.trim()
  if (!id) return ""
  const a = accounts.find((x) => String(x.id) === id)
  return a?.name?.trim() ?? ""
}

/**
 * Person + account (non-transfer Udhar) or person + route for transfer when not split.
 * Prefer {@link buildRecentTxSubtitleParts} for transfer rows (route on its own line).
 */
export function buildPersonAndAccountDetailLine(
  tx: RecentTransaction,
  accounts: Account[]
): string {
  const person = inferUdharPersonName(tx)
  const personPart = person === "Unknown" ? "" : person

  if (tx.type === "transfer") {
    const { fromLabel, toLabel } = getTransferRouteLabels(tx, accounts)
    const route = `${fromLabel} → ${toLabel}`
    if (personPart) return `${personPart} · ${route}`
    return route
  }

  const acct = resolveExpenseIncomeAccountLabel(tx, accounts)
  if (personPart && acct) return `${personPart} · ${acct}`
  if (personPart) return personPart
  return acct
}

export type RecentTxSubtitleParts = {
  /** Date · person, or full single line when `line2` is null. */
  line1: string
  /** `From A → B` for transfers; otherwise null. */
  line2: string | null
}

export type RecentTxSubtitleOptions = {
  includeDate?: boolean
}

/**
 * Splits subtitle so **transfer routes** (`from → to`) are always on a **separate line** from
 * date / person.
 */
export function buildRecentTxSubtitleParts(
  tx: RecentTransaction,
  accounts: Account[],
  options?: RecentTxSubtitleOptions
): RecentTxSubtitleParts {
  const includeDate = options?.includeDate !== false
  const dateStr = formatDate(tx.date)

  if (tx.type === "transfer") {
    const { fromLabel, toLabel } = getTransferRouteLabels(tx, accounts)
    const route = `${fromLabel} → ${toLabel}`
    const person = isUdharRecentTransaction(tx) ? inferUdharPersonName(tx) : ""
    const personPart = person && person !== "Unknown" ? person : ""
    const line1 = includeDate ? [dateStr, personPart].filter(Boolean).join(" · ") : personPart
    return { line1, line2: route }
  }

  if (isUdharRecentTransaction(tx)) {
    const detail = buildPersonAndAccountDetailLine(tx, accounts)
    const line1 = includeDate ? [dateStr, detail].filter(Boolean).join(" · ") : detail
    return { line1, line2: null }
  }

  const fromSource = tx.sourceName?.trim()
  const fromId =
    tx.accountId != null
      ? accounts.find((a) => String(a.id) === String(tx.accountId))?.name?.trim()
      : undefined
  const accountPart = fromSource || fromId || ""

  const rec = tx as unknown as Record<string, unknown>
  const personId = typeof rec.personId === "string" ? rec.personId.trim() : ""
  const personName = inferUdharPersonName(tx)
  let middle = accountPart
  if (personId && personName !== "Unknown") {
    middle = accountPart ? `${personName} · ${accountPart}` : personName
  }

  const notePart = sanitizeUserFacingApiText(tx.subtitle)
  const tail = [middle, notePart].filter(Boolean).join(" · ")
  const line1 = includeDate ? [dateStr, tail].filter(Boolean).join(" · ") : tail
  return { line1, line2: null }
}

/** Single-line subtitle (joins parts). Prefer {@link buildRecentTxSubtitleParts} in UIs for transfers. */
export function buildRecentTxSubtitleLine(
  tx: RecentTransaction,
  accounts: Account[],
  options?: RecentTxSubtitleOptions
): string {
  const { line1, line2 } = buildRecentTxSubtitleParts(tx, accounts, options)
  if (line2) {
    return [line1, line2].filter(Boolean).join(" · ")
  }
  return line1
}

function toDisplayWords(raw: string): string {
  const t = sanitizeUserFacingApiText(raw)
  if (!t) return ""
  if (/[A-Z]/.test(t)) return t
  return t
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

function resolveStrictUdharPersonName(tx: RecentTransaction, accounts: Account[]): string {
  const rec = tx as unknown as Record<string, unknown>
  const sourceName = sanitizeUserFacingApiText(
    typeof rec.sourceName === "string" ? rec.sourceName : ""
  )
  const destinationName = sanitizeUserFacingApiText(
    typeof rec.destinationName === "string" ? rec.destinationName : ""
  )
  const personName = sanitizeUserFacingApiText(
    typeof rec.personName === "string" ? rec.personName : ""
  )
  const accountNames = new Set<string>(
    accounts
      .map((a) => sanitizeUserFacingApiText(String(a.name ?? "")))
      .filter(Boolean)
      .map((n) => n.toLowerCase())
  )

  // Prefer explicit person fields from API, but never allow account labels here.
  const candidates = [destinationName, personName].filter(Boolean)
  for (const name of candidates) {
    if (name.toLowerCase() === sourceName.toLowerCase()) continue
    if (accountNames.has(name.toLowerCase())) continue
    return name
  }
  return ""
}

/** Status line shown at the bottom strip for all transaction cards. */
export function buildTransactionBottomLabel(
  tx: RecentTransaction,
  accounts: Account[]
): string | null {
  const udharType = extractUdharEntryType(tx)
  const personText = resolveStrictUdharPersonName(tx, accounts)
  if (udharType === "money_given")
    return personText ? `Payment given to ${personText}` : "Payment given"
  if (udharType === "money_taken")
    return personText ? `Money taken from ${personText}` : "Money taken"
  if (udharType === "payment_received")
    return personText ? `Payment received from ${personText}` : "Payment received"
  if (udharType === "payment_made")
    return personText ? `Payment made to ${personText}` : "Payment made"

  if (tx.type === "transfer") {
    const rec = tx as unknown as Record<string, unknown>
    const dest = String(rec.destinationType ?? rec.destination_type ?? tx.destinationType ?? "")
      .trim()
      .toLowerCase()
    if (dest === "loan_payment") return "Paid Loan EMI"
    if (dest === "credit_card_bill") return "Paid Credit Card EMI"
    const { toLabel } = getTransferRouteLabels(tx, accounts)
    if (toLabel && toLabel !== "—") return `Transfer to ${toLabel}`
    return "Transfer recorded"
  }

  if (tx.type === "expense") {
    const rec = tx as unknown as Record<string, unknown>
    const personId = typeof rec.personId === "string" ? rec.personId.trim() : ""
    const category = toDisplayWords(getRecentTransactionCategoryLabel(tx))
    if (personId && personText) {
      return `${category || "Expense"} expense on behalf of ${personText}`
    }
    if (category) return `Expense for ${category}`
    return "Expense recorded"
  }

  if (tx.type === "income") {
    const rec = tx as unknown as Record<string, unknown>
    const source = toDisplayWords(
      typeof rec.incomeSource === "string"
        ? rec.incomeSource
        : typeof rec.sourceName === "string"
          ? rec.sourceName
          : ""
    )
    if (source) return `Income from ${source}`
    return "Income received"
  }

  return null
}

/** Bold title line for recent / transfer rows. */
export function buildRecentTxPrimaryTitle(tx: RecentTransaction): string {
  const rec = tx as unknown as Record<string, unknown>
  const personId = typeof rec.personId === "string" ? rec.personId.trim() : ""
  const isOnBehalfExpense = String(tx.type ?? "").toLowerCase() === "expense" && Boolean(personId)
  if (isOnBehalfExpense) {
    const t = tx.title?.trim()
    if (t) return t
  }

  if (isUdharRecentTransaction(tx)) {
    const u = getUdharFlowPrimaryTitle(tx)
    if (u) return u
  }
  if (tx.type === "transfer") return "Transfer"
  return tx.title?.trim() || "Transaction"
}
