import { useCallback, useId, useMemo, useState } from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import { AppFieldError } from "@/components/app-field-error"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useOrderedPeopleForUdhar } from "@/hooks/use-ordered-people-for-udhar"
import { filterActiveAccounts } from "@/lib/api/account-schemas"
import type { CreateUdharEntryRequest, UdharEntryType } from "@/lib/api/udhar-schemas"
import { handleFormApiError } from "@/lib/forms/form-api-errors"
import { udharEntrySubmitSchema, udharPersonOnlySchema } from "@/lib/forms/udhar-form-schema"
import { zodErrorToFieldMap } from "@/lib/forms/zod-helpers"
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
    return form.askRepayBy.trim()
  }
  if (form.entryType === "money_taken") {
    return form.payBackBy.trim()
  }
  return form.date.trim()
}

/** Optional `feeAmount` for card-funded udhar; omit when empty or zero. */
function parseUdharFeeAmount(feeRaw: string): { ok: true; value?: string } | { ok: false } {
  const t = feeRaw.trim()
  if (!t) return { ok: true, value: undefined }
  const n = Number(t.replace(/,/g, ""))
  if (!Number.isFinite(n) || n < 0) return { ok: false }
  if (n === 0) return { ok: true, value: undefined }
  return { ok: true, value: Number.isInteger(n) ? String(n) : n.toFixed(2) }
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
  const isPersonOnly = mode === "person_only"
  const peopleListLoading = peopleQueryLoading || peopleQueryFetching
  const orderedPeople = useOrderedPeopleForUdhar(people, {
    enabled: open && !isPersonOnly,
  })
  const accountsListLoading = accountsLoading || accountsFetching

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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
      const parsed = udharPersonOnlySchema.safeParse({
        personName: form.personName,
        personPhone: form.personPhone,
      })
      if (!parsed.success) {
        setFieldErrors(zodErrorToFieldMap(parsed.error))
        return
      }
      setFieldErrors({})
      try {
        await createPerson({
          name: parsed.data.personName.trim(),
          phoneNumber: parsed.data.personPhone.trim() || undefined,
        }).unwrap()
        toast.success("Person added")
        setForm({ ...initialUdharFormState(), personMode: "new" })
        dismiss()
      } catch (err) {
        handleFormApiError(err, dispatch, { onDismiss: dismiss })
      }
      return
    }

    let effectivePersonId = form.selectedPersonId

    if (form.personMode === "new") {
      const personParsed = udharPersonOnlySchema.safeParse({
        personName: form.personName,
        personPhone: form.personPhone,
      })
      if (!personParsed.success) {
        setFieldErrors(zodErrorToFieldMap(personParsed.error))
        return
      }
      try {
        const response = await createPerson({
          name: personParsed.data.personName.trim(),
          phoneNumber: personParsed.data.personPhone.trim() || undefined,
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
        handleFormApiError(err, dispatch, { onDismiss: dismiss })
        return
      }
    } else {
      effectivePersonId = form.selectedPersonId
    }

    const entryParsed = udharEntrySubmitSchema(form.entryType).safeParse({
      personMode: form.personMode,
      personName: form.personName,
      selectedPersonId: effectivePersonId,
      amount: form.amount,
      accountId: form.accountId,
      date: form.date,
      askRepayBy: form.askRepayBy,
      payBackBy: form.payBackBy,
      entryType: form.entryType,
      fundingSource: form.fundingSource,
      feeAmount: form.feeAmount,
    })
    if (!entryParsed.success) {
      setFieldErrors(zodErrorToFieldMap(entryParsed.error))
      return
    }
    setFieldErrors({})

    const n = form.amount.replace(/\D/g, "")
    const amountInr = Number(n)
    const dueDate = resolveDueDateForSubmit(form)

    const balanceRows = udharBalancesCached

    if (form.entryType === "payment_received" || form.entryType === "payment_made") {
      const row = balanceRows.find((b) => b.personId === effectivePersonId)
      const check = validateUdharPaymentAgainstBalances(form.entryType, amountInr, row)
      if (!check.ok) {
        setFieldErrors({ amount: check.message })
        return
      }
    }

    let feeStr: string | undefined
    if (form.fundingSource === "credit_card") {
      const feeParsed = parseUdharFeeAmount(form.feeAmount)
      if (!feeParsed.ok) return
      feeStr = feeParsed.value
    }

    const payload: CreateUdharEntryRequest = {
      entryType: form.entryType,
      personId: effectivePersonId,
      amount: String(Math.round(amountInr)),
      date: form.date,
      dueDate,
      ...(form.fundingSource === "credit_card"
        ? {
            creditCardAccountId: form.accountId,
            ...(feeStr ? { feeAmount: feeStr } : {}),
          }
        : { accountId: form.accountId }),
      ...(form.note.trim() ? { note: form.note.trim() } : {}),
    }

    try {
      const response = await createUdharEntry(payload).unwrap()
      void response
      toast.success("udhar entry created successfully")
      setForm(initialUdharFormState())
      dismiss()
    } catch (err) {
      handleFormApiError(err, dispatch, { onDismiss: dismiss })
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
                aria-invalid={!!fieldErrors.personName}
              />
              <AppFieldError message={fieldErrors.personName} />
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
          people={orderedPeople}
          peopleListLoading={peopleListLoading}
          accounts={accounts}
          accountsListLoading={accountsListLoading}
          selectPersonId={selectPersonId}
          entryTypeScope={entryTypeScope}
          fieldErrors={fieldErrors}
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
