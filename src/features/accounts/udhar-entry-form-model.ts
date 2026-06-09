import { ArrowDown, ArrowUp } from "lucide-react"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"
import { todayIsoDate } from "@/lib/date/local-date"
import {
  getUdharEntryTypeDisplayLabel,
  UDHAR_DISPLAY_YOU_PAID,
  UDHAR_DISPLAY_YOU_RECEIVED,
} from "@/lib/transactions/transaction-udhar-title-labels"

export { todayIsoDate }

/** Limits which entry types appear in the shared Udhar form (People list vs Person view actions). */
export type UdharEntryTypeScope = "all" | "lend_take" | "given_only" | "taken_only"

export function udharEntryTypesForScope(scope: UdharEntryTypeScope | undefined): UdharEntryType[] {
  if (scope === "lend_take") return ["money_given", "money_taken"]
  if (scope === "given_only") return ["money_given"]
  if (scope === "taken_only") return ["money_taken"]
  return ["money_given", "money_taken"]
}

export function defaultUdharEntryTypeForScope(
  scope: UdharEntryTypeScope | undefined
): UdharEntryType {
  if (scope === "taken_only") return "money_taken"
  return "money_given"
}

export const UDHAR_ENTRY_TYPE_OPTIONS: {
  id: UdharEntryType
  label: string
  Icon: typeof ArrowUp
}[] = [
  {
    id: "money_given",
    label: getUdharEntryTypeDisplayLabel("money_given") ?? UDHAR_DISPLAY_YOU_PAID,
    Icon: ArrowUp,
  },
  {
    id: "money_taken",
    label: getUdharEntryTypeDisplayLabel("money_taken") ?? UDHAR_DISPLAY_YOU_RECEIVED,
    Icon: ArrowDown,
  },
]

export type UdharFundingSource = "account" | "credit_card"

export type UdharFormState = {
  personMode: "existing" | "new"
  selectedPersonId: string
  personName: string
  personPhone: string
  entryType: UdharEntryType
  amount: string
  accountId: string
  fundingSource: UdharFundingSource
  /** Digits only; optional. Sent as API `feeAmount` when paying from a credit card. */
  feeAmount: string
  date: string
  /** Shown for `money_given` only; sent as API `dueDate` when set. */
  askRepayBy: string
  /** Shown for `money_taken` only; sent as API `dueDate` when set. */
  payBackBy: string
  /** Optional bank / UPI / wallet transfer reference. */
  utr: string
  note: string
}

export function initialUdharFormState(): UdharFormState {
  const d = todayIsoDate()
  return {
    personMode: "existing",
    selectedPersonId: "",
    personName: "",
    personPhone: "",
    entryType: "money_given",
    amount: "",
    accountId: "",
    fundingSource: "account",
    feeAmount: "",
    date: d,
    askRepayBy: "",
    payBackBy: "",
    utr: "",
    note: "",
  }
}

export function buildUdharFormInitialState(
  initialPersonId?: string,
  initialAccountId?: string,
  initialEntryType?: UdharEntryType,
  entryTypeScope?: UdharEntryTypeScope
): UdharFormState {
  const base = initialUdharFormState()
  const pid = initialPersonId?.trim()
  const allowed = udharEntryTypesForScope(entryTypeScope)
  const requested = initialEntryType ?? defaultUdharEntryTypeForScope(entryTypeScope)
  const et = allowed.includes(requested) ? requested : allowed[0]
  return {
    ...base,
    entryType: et,
    personMode: "existing",
    selectedPersonId: pid ?? "",
    accountId: initialAccountId?.trim() ? initialAccountId.trim() : base.accountId,
  }
}
