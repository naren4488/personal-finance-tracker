import type { Dispatch, SetStateAction } from "react"
import { useMemo } from "react"
import { ChevronDown, CreditCard, Gem } from "lucide-react"
import { ToggleTile } from "@/components/toggle-tile"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Account } from "@/lib/api/account-schemas"
import { accountSelectLabel, filterNormalAccounts } from "@/lib/api/account-schemas"
import type { Person } from "@/lib/api/people-schemas"
import { isCreditCardAccount } from "@/lib/api/credit-card-map"
import {
  isUdharInflowEntryType,
  isUdharOutflowEntryType,
  udharAccountSelectLabelForEntryType,
} from "@/lib/udhar/udhar-entry-flow"
import {
  UDHAR_ENTRY_TYPE_OPTIONS,
  udharEntryTypesForScope,
  type UdharEntryTypeScope,
  type UdharFormState,
} from "@/features/accounts/udhar-entry-form-model"
import type { UdharEntryType } from "@/lib/api/udhar-schemas"
import {
  APP_FORM_AMOUNT_PRIMARY_CLASS,
  APP_FORM_FIELD_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SELECT_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_TEXTAREA_CLASS,
  APP_FORM_TWO_COL_GRID_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"

export type { UdharFormState } from "@/features/accounts/udhar-entry-form-model"

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export type UdharPersonUiMode = "locked_from_people" | "free"

function entryTypeTileLabel(id: UdharEntryType, scope: UdharEntryTypeScope | undefined): string {
  if (scope === "lend_take" || scope === "given_only" || scope === "taken_only") {
    if (id === "money_given") return "Money Given"
    if (id === "money_taken") return "Money Taken"
  }
  if (scope === "payments" || scope === "payment_received_only" || scope === "payment_made_only") {
    if (id === "payment_received") return "Received Back"
    if (id === "payment_made") return "Paid Back"
  }
  return UDHAR_ENTRY_TYPE_OPTIONS.find((o) => o.id === id)?.label ?? id
}

export type UdharEntryFormProps = {
  form: UdharFormState
  setForm: Dispatch<SetStateAction<UdharFormState>>
  personUiMode: UdharPersonUiMode
  lockedPersonName?: string
  people: Person[]
  peopleListLoading: boolean
  accounts: Account[]
  accountsListLoading: boolean
  selectPersonId: string
  /** When set, only those types are shown in the Type section (single form, narrowed choices). */
  entryTypeScope?: UdharEntryTypeScope
}

export function UdharEntryForm({
  form,
  setForm,
  personUiMode,
  lockedPersonName,
  people,
  peopleListLoading,
  accounts,
  accountsListLoading,
  selectPersonId,
  entryTypeScope = "all",
}: UdharEntryFormProps) {
  const entryTypeTiles = useMemo(() => {
    const allowed = new Set(udharEntryTypesForScope(entryTypeScope))
    return UDHAR_ENTRY_TYPE_OPTIONS.filter((o) => allowed.has(o.id))
  }, [entryTypeScope])

  const accountOptions = useMemo(() => {
    const active = filterNormalAccounts(accounts)
    if (form.fundingSource === "credit_card") {
      return accounts.filter(isCreditCardAccount)
    }
    return active.filter((a) => !isCreditCardAccount(a))
  }, [accounts, form.fundingSource])

  const outflow = isUdharOutflowEntryType(form.entryType)
  const inflow = isUdharInflowEntryType(form.entryType)
  const accountFieldLabel = udharAccountSelectLabelForEntryType(form.entryType)
  const showAskRepayBy = outflow && form.entryType === "money_given"
  const showTypeSection = entryTypeTiles.length > 1

  return (
    <div className={APP_FORM_STACK_CLASS}>
      {showTypeSection ? (
        <section>
          <Label className={APP_FORM_LABEL_CLASS}>Type</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {entryTypeTiles.map(({ id, Icon }) => (
              <ToggleTile
                key={id}
                selected={form.entryType === id}
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    entryType: id,
                    accountId: "",
                    feeAmount: "",
                  }))
                }
              >
                <Icon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                <span className="text-left leading-snug">
                  {entryTypeTileLabel(id, entryTypeScope)}
                </span>
              </ToggleTile>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Label className={APP_FORM_LABEL_CLASS}>Person</Label>
          {personUiMode === "free" ? (
            form.personMode === "existing" ? (
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => setForm((f) => ({ ...f, personMode: "new", selectedPersonId: "" }))}
              >
                + Add New
              </button>
            ) : (
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    personMode: "existing",
                    personName: "",
                    personPhone: "",
                  }))
                }
              >
                Select Existing
              </button>
            )
          ) : null}
        </div>
        {personUiMode === "locked_from_people" && lockedPersonName?.trim() ? (
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-3">
            <p className="text-base font-bold text-foreground">{lockedPersonName.trim()}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Pre-selected from profile.</p>
          </div>
        ) : (
          <>
            {form.personMode === "existing" ? (
              <div className="space-y-1.5">
                {peopleListLoading ? (
                  <p className="text-xs text-muted-foreground">Loading…</p>
                ) : null}
                <div className="relative">
                  <select
                    id={selectPersonId}
                    value={form.selectedPersonId}
                    disabled={peopleListLoading && people.length === 0}
                    onChange={(e) => setForm((f) => ({ ...f, selectedPersonId: e.target.value }))}
                    className={cn(
                      APP_FORM_SELECT_CLASS,
                      "w-full",
                      "disabled:cursor-not-allowed disabled:opacity-60",
                      !form.selectedPersonId && "text-muted-foreground"
                    )}
                  >
                    <option value="">Select person</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.phoneNumber?.trim() ? ` · ${p.phoneNumber}` : ""}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </div>
            ) : (
              <div className={APP_FORM_TWO_COL_GRID_CLASS}>
                <Input
                  placeholder="Person's name"
                  value={form.personName}
                  onChange={(e) => setForm((f) => ({ ...f, personName: e.target.value }))}
                  className={APP_FORM_FIELD_CLASS}
                  autoComplete="name"
                />
                <Input
                  type="tel"
                  placeholder="Phone (optional)"
                  value={form.personPhone}
                  onChange={(e) => setForm((f) => ({ ...f, personPhone: e.target.value }))}
                  className={APP_FORM_FIELD_CLASS}
                  autoComplete="tel"
                />
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <Label htmlFor="udhar-amount" className={APP_FORM_LABEL_CLASS}>
          Amount (₹)
        </Label>
        <Input
          id="udhar-amount"
          inputMode="numeric"
          placeholder="0"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d]/g, "") }))}
          className={cn(
            APP_FORM_AMOUNT_PRIMARY_CLASS,
            "text-2xl font-semibold text-primary/80 placeholder:text-primary/40"
          )}
        />
      </section>

      <section>
        <Label className={APP_FORM_LABEL_CLASS}>Payment method</Label>
        <div className="grid grid-cols-2 gap-1.5">
          <ToggleTile
            selected={form.fundingSource === "account"}
            onClick={() =>
              setForm((f) => ({
                ...f,
                fundingSource: "account",
                accountId: "",
                feeAmount: "",
              }))
            }
          >
            <CreditCard className="size-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
            <span className="text-left text-xs leading-snug sm:text-sm">Account / Cash / UPI</span>
          </ToggleTile>
          <ToggleTile
            selected={form.fundingSource === "credit_card"}
            onClick={() =>
              setForm((f) => ({
                ...f,
                fundingSource: "credit_card",
                accountId: "",
                feeAmount: "",
              }))
            }
          >
            <Gem className="size-4 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
            <span className="text-left text-xs leading-snug sm:text-sm">Credit Card</span>
          </ToggleTile>
        </div>
      </section>

      <section>
        <Label htmlFor="udhar-account" className={APP_FORM_LABEL_CLASS}>
          {accountFieldLabel}
        </Label>
        <div className="relative">
          {accountsListLoading ? (
            <p className="text-xs text-muted-foreground">Loading accounts…</p>
          ) : accountOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {form.fundingSource === "credit_card"
                ? "Add a credit card first to use this payment method."
                : "Add an account first to link this entry."}
            </p>
          ) : null}
          <select
            id="udhar-account"
            value={form.accountId}
            disabled={accountsListLoading || accountOptions.length === 0}
            onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
            className={cn(
              APP_FORM_SELECT_CLASS,
              "w-full",
              !form.accountId && "text-muted-foreground",
              "disabled:cursor-not-allowed disabled:opacity-60"
            )}
          >
            <option value="">Select account</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {accountSelectLabel(a)}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
      </section>

      {form.fundingSource === "credit_card" ? (
        <section>
          <Label htmlFor="udhar-card-fee" className={APP_FORM_LABEL_CLASS}>
            Card / transaction fee (₹){" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="udhar-card-fee"
            inputMode="decimal"
            placeholder="0"
            value={form.feeAmount}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d.]/g, "")
              const parts = v.split(".")
              const next = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : v
              setForm((f) => ({ ...f, feeAmount: next }))
            }}
            className={APP_FORM_FIELD_CLASS}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Optional: bank or card charges (cash advance, etc.).
          </p>
        </section>
      ) : null}

      <section>
        <Label htmlFor="udhar-date" className={APP_FORM_LABEL_CLASS}>
          Date
        </Label>
        <Input
          id="udhar-date"
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          className={cn(APP_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
        />
      </section>

      {showAskRepayBy ? (
        <section>
          <Label htmlFor="udhar-ask-repay" className={APP_FORM_LABEL_CLASS}>
            Ask money back by
          </Label>
          <Input
            id="udhar-ask-repay"
            type="date"
            value={form.askRepayBy}
            onChange={(e) => setForm((f) => ({ ...f, askRepayBy: e.target.value }))}
            className={cn(APP_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            When should this person return the money?
          </p>
        </section>
      ) : null}

      {inflow || (outflow && form.entryType === "payment_made") ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          {inflow
            ? "Due date for this entry matches the transaction date above."
            : "Repayment due date matches the transaction date above."}
        </p>
      ) : null}

      <section>
        <Label htmlFor="udhar-note" className={APP_FORM_LABEL_CLASS}>
          Note <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <textarea
          id="udhar-note"
          rows={2}
          placeholder="What was this for?"
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          className={cn(APP_FORM_TEXTAREA_CLASS, "min-h-20 resize-none")}
        />
      </section>
    </div>
  )
}
