import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"

/** Limits which entry types appear in the shared Udhar form (People list vs Person view actions). */
export type UdharEntryTypeScope =
  | "all"
  | "lend_take"
  /** Person view: one-tap "Given" — form opens as money_given with no type toggle. */
  | "given_only"
  | "taken_only"
  | "payments"
  | "payment_received_only"
  | "payment_made_only"

export function udharEntryTypesForScope(scope: UdharEntryTypeScope | undefined): UdharEntryType[] {
  if (scope === "lend_take") return ["money_given", "money_taken"]
  if (scope === "given_only") return ["money_given"]
  if (scope === "taken_only") return ["money_taken"]
  if (scope === "payments") return ["payment_received", "payment_made"]
  if (scope === "payment_received_only") return ["payment_received"]
  if (scope === "payment_made_only") return ["payment_made"]
  return ["money_given", "money_taken", "payment_received", "payment_made"]
}

export function defaultUdharEntryTypeForScope(
  scope: UdharEntryTypeScope | undefined
): UdharEntryType {
  if (scope === "lend_take") return "money_given"
  if (scope === "given_only") return "money_given"
  if (scope === "taken_only") return "money_taken"
  if (scope === "payments") return "payment_received"
  if (scope === "payment_received_only") return "payment_received"
  if (scope === "payment_made_only") return "payment_made"
  return "money_given"
}

export const UDHAR_ENTRY_TYPE_OPTIONS: {
  id: UdharEntryType
  label: string
  Icon: typeof ArrowUp
}[] = [
  { id: "money_given", label: "Money Given (Lent)", Icon: ArrowUp },
  { id: "money_taken", label: "Money Taken (Borrowed)", Icon: ArrowDown },
  { id: "payment_received", label: "Payment Received", Icon: ArrowLeft },
  { id: "payment_made", label: "Payment Made", Icon: ArrowRight },
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
  /** Shown for `money_given` only; sent as API `dueDate`. */
  askRepayBy: string
  /** Shown for `money_taken` only; sent as API `dueDate`. */
  payBackBy: string
  note: string
}

export function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
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
    askRepayBy: d,
    payBackBy: d,
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
