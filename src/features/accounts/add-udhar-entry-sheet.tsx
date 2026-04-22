import { useCallback, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { X } from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { filterActiveAccounts } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import type { CreateUdharEntryRequest, UdharEntryType } from "@/lib/api/udhar-schemas"
import { endUserSession } from "@/lib/auth/end-session"
import {
  APP_FORM_FIELD_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_TITLE_CLASS,
  APP_FORM_TWO_COL_GRID_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"
import { validateUdharPaymentAgainstBalances } from "@/lib/udhar/udhar-payment-validation"
import { UdharEntryForm } from "@/features/accounts/udhar-entry-form"
import {
  buildUdharFormInitialState,
  initialUdharFormState,
  type UdharEntryTypeScope,
  type UdharFormState,
} from "@/features/accounts/udhar-entry-form-model"
import {
  useCreatePersonMutation,
  useCreateUdharEntryMutation,
  useGetAccountsQuery,
  useGetPeopleQuery,
  useGetUdharAccountBalancesQuery,
} from "@/store/api/base-api"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

export type { UdharFormState } from "@/features/accounts/udhar-entry-form-model"

export type AddUdharEntrySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode?: "entry" | "person_only"
  initialPersonId?: string
  initialAccountId?: string
  /**
   * `from_people` — person is fixed (ledger / People row). `free` — manual person selection (Entries, etc.).
   */
  personContext?: "from_people" | "free"
  /** Quick-open preset (Give / Take / Record payment). */
  defaultType?: UdharEntryType
  /**
   * @deprecated Use `defaultType`. Kept for compatibility with older call sites.
   */
  initialEntryType?: UdharEntryType
  /** Narrows the Type tiles (Person view actions vs full form). */
  entryTypeScope?: UdharEntryTypeScope
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
  personContext?: "from_people" | "free"
  defaultType?: UdharEntryType
  initialEntryType?: UdharEntryType
  entryTypeScope?: UdharEntryTypeScope
}

function resolveDueDateForSubmit(form: UdharFormState): string {
  if (form.entryType === "money_given") {
    return form.askRepayBy.trim() || form.date.trim()
  }
  return form.date.trim()
}

function AddUdharEntrySheetMounted({
  open,
  onOpenChange,
  mode,
  initialPersonId,
  initialAccountId,
  personContext = "free",
  defaultType,
  initialEntryType,
  entryTypeScope = "all",
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
    if (isPersonOnly) return { ...initialUdharFormState(), personMode: "new" as const }
    return buildUdharFormInitialState(
      initialPersonId,
      initialAccountId,
      defaultType ?? initialEntryType,
      entryTypeScope
    )
  })

  const lockedPersonName = useMemo(() => {
    const id = initialPersonId?.trim()
    if (!id) return ""
    return people.find((p) => String(p.id) === id)?.name?.trim() ?? ""
  }, [initialPersonId, people])

  const personUiMode =
    !isPersonOnly && personContext === "from_people" && initialPersonId?.trim()
      ? "locked_from_people"
      : "free"

  const { data: udharBalancesCached = [] } = useGetUdharAccountBalancesQuery(
    { accountId: form.accountId },
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
        setForm({ ...initialUdharFormState(), personMode: "new" })
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

    const dueDate = resolveDueDateForSubmit(form)
    if (!dueDate) {
      toast.error(
        form.entryType === "money_given" ? "Select ask money back by date" : "Select date"
      )
      return
    }

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
      dueDate,
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    }

    try {
      const response = await createUdharEntry(payload).unwrap()
      void response
      toast.success("udhar entry created successfully")
      setForm(initialUdharFormState())
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
      {isPersonOnly ? (
        <div className={APP_FORM_STACK_CLASS}>
          <section>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <Label className={APP_FORM_LABEL_CLASS}>Person</Label>
            </div>
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
          </section>
        </div>
      ) : (
        <UdharEntryForm
          form={form}
          setForm={setForm}
          personUiMode={personUiMode}
          lockedPersonName={lockedPersonName}
          people={people}
          peopleListLoading={peopleListLoading}
          accounts={accounts}
          accountsListLoading={accountsListLoading}
          selectPersonId={selectPersonId}
          entryTypeScope={entryTypeScope}
        />
      )}
    </FormDialog>
  )
}

export function AddUdharEntrySheet({
  open,
  onOpenChange,
  mode = "entry",
  initialPersonId,
  initialAccountId,
  personContext = "free",
  defaultType,
  initialEntryType,
  entryTypeScope = "all",
}: AddUdharEntrySheetProps) {
  if (!open) return null
  return (
    <AddUdharEntrySheetMounted
      open={open}
      onOpenChange={onOpenChange}
      mode={mode}
      initialPersonId={initialPersonId}
      initialAccountId={initialAccountId}
      personContext={personContext}
      defaultType={defaultType}
      initialEntryType={initialEntryType}
      entryTypeScope={entryTypeScope}
    />
  )
}
