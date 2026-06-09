import { buildAccountsDetailPath } from "@/features/accounts/accounts-route"
import type { EntityCatalog } from "@/lib/commitments/commitment-kind-config"
import {
  getRecentTransactionCreditCardAccountId,
  isUdharRecentTransaction,
  type RecentTransaction,
} from "@/lib/api/transaction-schemas"

export type TransactionNavigationTarget = {
  path: string
  label: string
  entityKind: "person" | "loan" | "card" | "account"
  entityId: string
}

export type TransactionRowAction =
  | { type: "navigate"; path: string; label: string }
  | { type: "toast"; message: string }
  | { type: "none" }

function recentRowPersonId(tx: RecentTransaction): string {
  const rec = tx as unknown as Record<string, unknown>
  const a = rec.personId ?? rec.person_id
  if (typeof a === "string" && a.trim()) return a.trim()
  return ""
}

function loanAccountIdFromTx(tx: RecentTransaction): string {
  const rec = tx as unknown as Record<string, unknown>
  return String(tx.loanAccountId ?? rec.loan_account_id ?? rec.loanId ?? rec.loan_id ?? "").trim()
}

function readDestinationType(tx: RecentTransaction): string {
  const rec = tx as unknown as Record<string, unknown>
  return String(rec.destinationType ?? rec.destination_type ?? tx.destinationType ?? "")
    .trim()
    .toLowerCase()
}

function accountKindInCatalog(
  accountId: string,
  catalog: EntityCatalog
): "loan" | "card" | "account" {
  const id = accountId.trim()
  if (catalog.loans.some((a) => String(a.id) === id)) return "loan"
  if (catalog.creditCards.some((a) => String(a.id) === id)) return "card"
  return "account"
}

function accountNavigationTarget(
  accountId: string,
  catalog?: EntityCatalog
): TransactionNavigationTarget {
  const id = accountId.trim()
  const kind = catalog ? accountKindInCatalog(id, catalog) : "account"
  const pathKind = kind === "loan" ? "loan" : kind === "card" ? "card" : "account"
  const labels: Record<typeof pathKind, string> = {
    loan: "View loan",
    card: "View card",
    account: "View account",
  }
  return {
    path: buildAccountsDetailPath({ kind: pathKind, id }),
    label: labels[pathKind],
    entityKind: kind,
    entityId: id,
  }
}

function normalizePath(path: string): string {
  const base = path.split("?")[0]?.split("#")[0] ?? path
  return base.replace(/\/+$/, "") || "/"
}

export function resolveTransactionNavigationTarget(
  tx: RecentTransaction,
  catalog?: EntityCatalog
): TransactionNavigationTarget | null {
  const personId = recentRowPersonId(tx)
  const isUdhar = isUdharRecentTransaction(tx)

  if (personId) {
    return {
      path: `/people/${encodeURIComponent(personId)}`,
      label: "View person",
      entityKind: "person",
      entityId: personId,
    }
  }

  if (isUdhar) return null

  const dest = readDestinationType(tx)
  const cardId = getRecentTransactionCreditCardAccountId(tx)
  const loanId = loanAccountIdFromTx(tx)

  if (dest === "credit_card_bill" && cardId) {
    return {
      path: buildAccountsDetailPath({ kind: "card", id: cardId }),
      label: "View card",
      entityKind: "card",
      entityId: cardId,
    }
  }

  if (dest === "loan_payment" && loanId) {
    return {
      path: buildAccountsDetailPath({ kind: "loan", id: loanId }),
      label: "View loan",
      entityKind: "loan",
      entityId: loanId,
    }
  }

  const accountId = String(tx.accountId ?? "").trim()

  if (tx.type === "expense") {
    if (cardId) {
      return {
        path: buildAccountsDetailPath({ kind: "card", id: cardId }),
        label: "View card",
        entityKind: "card",
        entityId: cardId,
      }
    }
    if (accountId && catalog && catalog.creditCards.some((a) => String(a.id) === accountId)) {
      return {
        path: buildAccountsDetailPath({ kind: "card", id: accountId }),
        label: "View card",
        entityKind: "card",
        entityId: accountId,
      }
    }
  }

  if (tx.type === "transfer") {
    if (loanId) return accountNavigationTarget(loanId, catalog)
    if (cardId && (dest === "credit_card_bill" || dest.includes("card"))) {
      return accountNavigationTarget(cardId, catalog)
    }
    const toId = String(tx.toAccountId ?? "").trim()
    if (dest === "account" && toId) return accountNavigationTarget(toId, catalog)
    if (toId) return accountNavigationTarget(toId, catalog)
    if (accountId) return accountNavigationTarget(accountId, catalog)
    return null
  }

  if (accountId) return accountNavigationTarget(accountId, catalog)
  if (loanId) return accountNavigationTarget(loanId, catalog)
  if (cardId) return accountNavigationTarget(cardId, catalog)

  return null
}

export function resolveTransactionRowAction(
  tx: RecentTransaction,
  catalog?: EntityCatalog,
  options?: { currentPath?: string }
): TransactionRowAction {
  const nav = resolveTransactionNavigationTarget(tx, catalog)
  if (!nav) return { type: "none" }

  const current = options?.currentPath?.trim()
  if (current && normalizePath(current) === normalizePath(nav.path)) {
    return { type: "none" }
  }

  if (!catalog) {
    return { type: "navigate", path: nav.path, label: nav.label }
  }

  if (nav.entityKind === "person") {
    if (catalog.people.some((p) => String(p.id) === nav.entityId)) {
      return { type: "navigate", path: nav.path, label: nav.label }
    }
    return { type: "toast", message: "This person has been deleted." }
  }

  if (nav.entityKind === "card") {
    if (catalog.creditCards.some((a) => String(a.id) === nav.entityId)) {
      return { type: "navigate", path: nav.path, label: nav.label }
    }
    return { type: "toast", message: "This credit card has been deleted." }
  }

  if (nav.entityKind === "loan") {
    if (catalog.loans.some((a) => String(a.id) === nav.entityId)) {
      return { type: "navigate", path: nav.path, label: nav.label }
    }
    return { type: "toast", message: "This loan has been deleted." }
  }

  if (catalog.normalAccounts.some((a) => String(a.id) === nav.entityId)) {
    return { type: "navigate", path: nav.path, label: nav.label }
  }

  return { type: "toast", message: "This account has been deleted." }
}
