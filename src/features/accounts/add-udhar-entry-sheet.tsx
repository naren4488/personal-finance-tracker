import { useCallback, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { ToggleTile } from "@/components/toggle-tile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { accountSelectLabel, filterActiveAccounts } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import type { CreateUdharEntryRequest } from "@/lib/api/udhar-schemas"
import { endUserSession } from "@/lib/auth/end-session"
import {
  APP_FORM_AMOUNT_PRIMARY_CLASS,
  APP_FORM_FIELD_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SELECT_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_TEXTAREA_CLASS,
  APP_FORM_TITLE_CLASS,
  APP_FORM_TWO_COL_GRID_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"
import { validateUdharPaymentAgainstBalances } from "@/lib/udhar/udhar-payment-validation"
import {
  useCreatePersonMutation,
  useCreateUdharEntryMutation,
  useGetAccountsQuery,
  useGetPeopleQuery,
  useGetUdharAccountBalancesQuery,
} from "@/store/api/base-api"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

const ENTRY_TYPES = [
  { id: "money_given" as const, label: "Money Given (Lent)", Icon: ArrowUp },
  { id: "money_taken" as const, label: "Money Taken (Borrowed)", Icon: ArrowDown },
  { id: "payment_received" as const, label: "Payment Received", Icon: ArrowLeft },
  { id: "payment_made" as const, label: "Payment Made", Icon: ArrowRight },
]

type EntryTypeId = (typeof ENTRY_TYPES)[number]["id"]
type PersonMode = "existing" | "new"

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export type UdharFormState = {
  personMode: PersonMode
  selectedPersonId: string
  personName: string
  personPhone: string
  entryType: EntryTypeId
  amount: string
  accountId: string
  date: string
  dueDate: string
  note: string
}

function initialFormState(): UdharFormState {
  const d = todayIsoDate()
  return {
    personMode: "existing",
    selectedPersonId: "",
    personName: "",
    personPhone: "",
    entryType: "money_given",
    amount: "",
    accountId: "",
    date: d,
    dueDate: d,
    note: "",
  }
}

/** Used when opening Add Udhar from a People row (person + optional account pre-selected). */
function buildEntryInitialState(
  initialPersonId?: string,
  initialAccountId?: string
): UdharFormState {
  const base = initialFormState()
  const pid = initialPersonId?.trim()
  if (!pid) return base
  return {
    ...base,
    personMode: "existing",
    selectedPersonId: pid,
    accountId: initialAccountId?.trim() ? initialAccountId.trim() : base.accountId,
  }
}

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export type AddUdharEntrySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: "entry" | "person_only"
  /** When `mode` is `entry`, pre-select this person (existing) in the form. */
  initialPersonId?: string
  /** When `mode` is `entry`, pre-select this account id when opening from a filtered People list. */
  initialAccountId?: string
}

function isAuthTokenRequiredMessage(message: string): boolean {
  return message.toLowerCase().includes("authorization token is required")
}

type MountedProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "entry" | "person_only"
  initialPersonId?: string
  initialAccountId?: string
}

/**
 * Renders only while the sheet is open. Unmounting clears form state without useEffect resets.
 */
function AddUdharEntrySheetMounted({
  open,
  onOpenChange,
  mode,
  initialPersonId,
  initialAccountId,
}: MountedProps) {
  const titleId = useId()
  const selectPersonId = useId()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const {
    data: people = [],
    isLoading: peopleQueryLoading,
    isFetching: peopleQueryFetching,
  } = useGetPeopleQuery({}, { skip: !user })
  const [createPerson, { isLoading: isCreatingPerson }] = useCreatePersonMutation()
  const [createUdharEntry, { isLoading: isUdharSubmitting }] = useCreateUdharEntryMutation()
  const {
    data: accountsRaw = [],
    isLoading: accountsLoading,
    isFetching: accountsFetching,
  } = useGetAccountsQuery(undefined, { skip: !user })
  const accounts = useMemo(() => filterActiveAccounts(accountsRaw), [accountsRaw])
  const peopleListLoading = peopleQueryLoading || peopleQueryFetching
  const accountsListLoading = accountsLoading || accountsFetching

  const isPersonOnly = mode === "person_only"
  const [form, setForm] = useState(() => {
    if (isPersonOnly) return { ...initialFormState(), personMode: "new" as const }
    return buildEntryInitialState(initialPersonId, initialAccountId)
  })

  const { data: udharBalancesCached = [] } = useGetUdharAccountBalancesQuery(
    { accountId: form.accountId },
    /**
     * Backend on this project does not expose a compatible udhar-summary route yet.
     * Keep local cache shape for optional client-side guards, but disable live fetch
     * so account selection / submit does not trigger noisy 405 console errors.
     */
    { skip: true }
  )

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (isPersonOnly) {
      const name = form.personName.trim()
      if (!name) {
        toast.error("Enter the person's name")
        return
      }
      try {
        await createPerson({
          name,
          phoneNumber: form.personPhone.trim() || undefined,
        }).unwrap()
        toast.success("Person added")
        setForm(initialFormState())
        dismiss()
      } catch (err) {
        const msg = getErrorMessage(err)
        if (isAuthTokenRequiredMessage(msg)) {
          toast.error("Please sign in again")
          endUserSession(dispatch)
          dismiss()
          navigate("/login", { replace: true })
          return
        }
        toast.error(msg)
      }
      return
    }

    let effectivePersonId = form.selectedPersonId

    if (form.personMode === "new") {
      const name = form.personName.trim()
      if (!name) {
        toast.error("Enter the person's name")
        return
      }
      try {
        const response = await createPerson({
          name,
          phoneNumber: form.personPhone.trim() || undefined,
        }).unwrap()
        toast.success("Person added")
        setForm((f) => ({
          ...f,
          personMode: "existing",
          personName: "",
          personPhone: "",
          selectedPersonId: response.id,
        }))
        effectivePersonId = response.id
      } catch (err) {
        const msg = getErrorMessage(err)
        if (isAuthTokenRequiredMessage(msg)) {
          toast.error("Please sign in again")
          endUserSession(dispatch)
          dismiss()
          navigate("/login", { replace: true })
          return
        }
        toast.error(msg)
        return
      }
    } else {
      if (!form.selectedPersonId) {
        toast.error("Select a person")
        return
      }
      effectivePersonId = form.selectedPersonId
    }

    const n = form.amount.replace(/\D/g, "")
    if (!n || Number(n) <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    const amountInr = Number(n)
    if (!Number.isFinite(amountInr) || amountInr <= 0) {
      toast.error("Enter a valid amount")
      return
    }
    if (!form.accountId) {
      toast.error("Select an account")
      return
    }
    if (!form.dueDate) {
      toast.error("Select due date")
      return
    }

    /** Best-effort client-side caps; when summary API is unavailable we skip this guard. */
    const balanceRows = udharBalancesCached

    if (form.entryType === "payment_received" || form.entryType === "payment_made") {
      const row = balanceRows.find((b) => b.personId === effectivePersonId)
      const check = validateUdharPaymentAgainstBalances(form.entryType, amountInr, row)
      if (!check.ok) {
        toast.error(check.message)
        return
      }
    }

    const payload: CreateUdharEntryRequest = {
      entryType: form.entryType,
      personId: effectivePersonId,
      amount: String(Math.round(amountInr)),
      accountId: form.accountId,
      date: form.date,
      dueDate: form.dueDate,
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    }

    try {
      console.log("[AddUdharEntrySheet] submit payload:", payload)
      const response = await createUdharEntry(payload).unwrap()
      console.log("[AddUdharEntrySheet] submit success response:", response)
      toast.success("udhar entry created successfully")
      setForm(initialFormState())
      dismiss()
    } catch (err) {
      console.error("[AddUdharEntrySheet] submit failed:", err)
      const msg = getErrorMessage(err)
      if (isAuthTokenRequiredMessage(msg)) {
        toast.error("Please sign in again")
        endUserSession(dispatch)
        dismiss()
        navigate("/login", { replace: true })
        return
      }
      toast.error(msg)
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle={isPersonOnly ? "Add Person" : "Add Udhar Entry"}
      header={
        <header className={cn(APP_FORM_HEADER_CLASS, "flex items-start justify-between gap-2")}>
          <h2 id={titleId} className={APP_FORM_TITLE_CLASS}>
            {isPersonOnly ? "Add Person" : "Add Udhar Entry"}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 rounded-full text-muted-foreground hover:text-foreground"
            aria-label="Close"
            onClick={dismiss}
          >
            <X className="size-5" strokeWidth={2} />
          </Button>
        </header>
      }
      formProps={{ onSubmit: handleSubmit }}
      footer={
        <Button
          type="submit"
          disabled={isCreatingPerson || isUdharSubmitting}
          className={APP_FORM_SUBMIT_CLASS}
        >
          {isCreatingPerson
            ? "Saving…"
            : isUdharSubmitting
              ? "Submitting…"
              : isPersonOnly
                ? "Add Person"
                : "Add Entry"}
        </Button>
      }
    >
      <div className={APP_FORM_STACK_CLASS}>
        <section>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <Label className={APP_FORM_LABEL_CLASS}>Person</Label>
            {!isPersonOnly && form.personMode === "existing" ? (
              <button
                type="button"
                className="text-xs font-semibold text-primary hover:underline"
                onClick={() => setForm((f) => ({ ...f, personMode: "new", selectedPersonId: "" }))}
              >
                + Add New
              </button>
            ) : !isPersonOnly ? (
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
            ) : null}
          </div>

          {!isPersonOnly && form.personMode === "existing" ? (
            <div className="space-y-1.5">
              {peopleListLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
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
        </section>
        {!isPersonOnly ? (
          <>
            <section>
              <Label className={APP_FORM_LABEL_CLASS}>Type</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ENTRY_TYPES.map(({ id, label, Icon }) => (
                  <ToggleTile
                    key={id}
                    selected={form.entryType === id}
                    onClick={() => setForm((f) => ({ ...f, entryType: id }))}
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={2.25} aria-hidden />
                    <span>{label}</span>
                  </ToggleTile>
                ))}
              </div>
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
                onChange={(e) =>
                  setForm((f) => ({ ...f, amount: e.target.value.replace(/[^\d]/g, "") }))
                }
                className={cn(
                  APP_FORM_AMOUNT_PRIMARY_CLASS,
                  "text-2xl font-semibold text-primary/80 placeholder:text-primary/40"
                )}
              />
            </section>

            <section>
              <Label htmlFor="udhar-account" className={APP_FORM_LABEL_CLASS}>
                Account
              </Label>
              <div className="relative">
                {accountsListLoading ? (
                  <p className="text-xs text-muted-foreground">Loading accounts…</p>
                ) : accounts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add an account first to link this entry.
                  </p>
                ) : null}
                <select
                  id="udhar-account"
                  value={form.accountId}
                  disabled={accountsListLoading || accounts.length === 0}
                  onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                  className={cn(
                    APP_FORM_SELECT_CLASS,
                    "w-full",
                    !form.accountId && "text-muted-foreground",
                    "disabled:cursor-not-allowed disabled:opacity-60"
                  )}
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountSelectLabel(a)}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </section>

            <div className={APP_FORM_TWO_COL_GRID_CLASS}>
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
              <section>
                <Label htmlFor="udhar-due-date" className={APP_FORM_LABEL_CLASS}>
                  Due date
                </Label>
                <Input
                  id="udhar-due-date"
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                  className={cn(APP_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
                />
              </section>
            </div>

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
          </>
        ) : null}
      </div>
    </FormDialog>
  )
}

/** Wrapper has no hooks — mounted subtree owns form state and resets on unmount when `open` is false. */
export function AddUdharEntrySheet({
  open,
  onOpenChange,
  mode = "entry",
  initialPersonId,
  initialAccountId,
}: AddUdharEntrySheetProps) {
  if (!open) return null
  return (
    <AddUdharEntrySheetMounted
      open={open}
      onOpenChange={onOpenChange}
      mode={mode}
      initialPersonId={initialPersonId}
      initialAccountId={initialAccountId}
    />
  )
}
