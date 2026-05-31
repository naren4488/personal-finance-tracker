/** Entity kinds that support guarded delete in the UI. */
export type EntityDeleteKind = "account" | "loan" | "credit_card" | "person"

export type EntityDeleteBlock = {
  blocked: true
  message: string
}

export type EntityDeleteEligibility = {
  /** True when delete must be disabled (history exists or still checking). */
  blocked: boolean
  /** User-facing reason when blocked; null when delete is allowed. */
  message: string | null
  /** Ledger/history probe still in flight (list views without prefetched ledger). */
  isChecking: boolean
}

const EMPTY_ELIGIBLE: EntityDeleteEligibility = {
  blocked: false,
  message: null,
  isChecking: false,
}

export function getEntityDeleteBlockMessage(kind: EntityDeleteKind): string {
  switch (kind) {
    case "account":
      return "This account cannot be deleted because it has transaction history."
    case "loan":
      return "This loan cannot be deleted because it has transaction history."
    case "credit_card":
      return "This credit card cannot be deleted because it has transaction history."
    case "person":
      return "This person cannot be deleted because related udhar entries exist."
    default:
      return "Delete is only available for empty entities with no history."
  }
}

export function getPersonDeleteBlockMessage(targetMode: "account" | "person"): string {
  if (targetMode === "account") {
    return "This person cannot be deleted because the linked account has transaction history."
  }
  return getEntityDeleteBlockMessage("person")
}

/**
 * When ledger entries are already loaded (detail screens), derive block state without an extra fetch.
 */
export function eligibilityFromLedgerCount(
  ledgerEntryCount: number,
  kind: EntityDeleteKind,
  options?: { isChecking?: boolean }
): EntityDeleteEligibility {
  if (options?.isChecking) {
    return {
      blocked: true,
      message: null,
      isChecking: true,
    }
  }
  if (ledgerEntryCount > 0) {
    return {
      blocked: true,
      message: getEntityDeleteBlockMessage(kind),
      isChecking: false,
    }
  }
  return { ...EMPTY_ELIGIBLE }
}

export function eligibilityFromPersonLedger(
  ledgerEntryCount: number,
  targetMode: "account" | "person",
  options?: { isChecking?: boolean }
): EntityDeleteEligibility {
  if (options?.isChecking) {
    return {
      blocked: true,
      message: null,
      isChecking: true,
    }
  }
  if (ledgerEntryCount > 0) {
    return {
      blocked: true,
      message: getPersonDeleteBlockMessage(targetMode),
      isChecking: false,
    }
  }
  return { ...EMPTY_ELIGIBLE }
}
