import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useId, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { AppFormInputField } from "@/components/app-form-fields"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  buildCommitmentCreatePayload,
  buildEntityCatalog,
  COMMITMENT_KIND_DEFINITIONS,
  getCommitmentKindDef,
  getEntityOptionsForKind,
  PAYABLE_COMMITMENT_STATUSES,
  type CommitmentDirection,
  type CommitmentKindValue,
} from "@/lib/commitments/commitment-kind-config"
import {
  commitmentFormDefaultValues,
  commitmentFormSchema,
  type CommitmentFormValues,
} from "@/lib/forms/commitment-form-schema"
import { handleFormApiError } from "@/lib/forms/form-api-errors"
import type { Commitment } from "@/lib/api/commitment-schemas"
import {
  APP_FORM_FIELD_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SELECT_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_TITLE_CLASS,
  APP_FORM_TWO_COL_GRID_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"
import {
  useCreateCommitmentMutation,
  useGetAccountsQuery,
  useGetCreditCardsQuery,
  useGetLoansQuery,
  useGetPeopleQuery,
} from "@/store/api/base-api"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

const DIRECTIONS: { value: CommitmentDirection; label: string }[] = [
  { value: "payable", label: "Payable" },
  { value: "incoming", label: "Incoming" },
]

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export type AddCommitmentModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful save (modal closes first). */
  onCreatedSuccess?: (commitment: Commitment) => void
}

type MountedProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreatedSuccess?: (commitment: Commitment) => void
}

function AddCommitmentModalMounted({ open, onOpenChange, onCreatedSuccess }: MountedProps) {
  const titleId = useId()
  const entitySelectId = useId()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const [createCommitment, { isLoading: isCreating }] = useCreateCommitmentMutation()

  const { data: people = [], isFetching: peopleFetching } = useGetPeopleQuery(undefined, {
    skip: !user || !open,
  })
  const { data: loans = [], isFetching: loansFetching } = useGetLoansQuery(undefined, {
    skip: !user || !open,
  })
  const { data: creditCards = [], isFetching: cardsFetching } = useGetCreditCardsQuery(undefined, {
    skip: !user || !open,
  })
  const { data: allAccounts = [], isFetching: accountsFetching } = useGetAccountsQuery(undefined, {
    skip: !user || !open,
  })

  const catalog = useMemo(
    () => buildEntityCatalog({ people, loans, creditCards, allAccounts }),
    [people, loans, creditCards, allAccounts]
  )

  const form = useForm<CommitmentFormValues>({
    resolver: zodResolver(commitmentFormSchema),
    defaultValues: commitmentFormDefaultValues(),
  })

  const kind = useWatch({ control: form.control, name: "kind" })
  const direction = useWatch({ control: form.control, name: "direction" })
  const kindDef = useMemo(() => getCommitmentKindDef(kind), [kind])
  const showStatus = direction === "payable"
  const entityOptions = useMemo(() => getEntityOptionsForKind(kind, catalog), [kind, catalog])
  const showEntity = kindDef.entity.field !== "none"

  const entityBusy = useMemo(() => {
    if (!showEntity) return false
    const entity = kindDef.entity
    if (entity.field === "personId") return peopleFetching
    if (entity.field === "accountId") {
      if (entity.source === "loans") return loansFetching
      if (entity.source === "credit_cards") return cardsFetching
      return accountsFetching
    }
    return false
  }, [showEntity, kindDef, peopleFetching, loansFetching, cardsFetching, accountsFetching])

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  function setKind(nextKind: CommitmentKindValue) {
    const def = getCommitmentKindDef(nextKind)
    form.setValue("kind", nextKind)
    form.setValue("direction", def.defaultDirection)
    if (def.defaultDirection === "payable") {
      form.setValue("status", "pending")
    } else {
      form.setValue("status", undefined)
      form.clearErrors("status")
    }
    form.setValue("entityId", "")
    form.clearErrors("entityId")
  }

  function setDirection(nextDirection: CommitmentDirection) {
    form.setValue("direction", nextDirection)
    if (nextDirection === "payable") {
      form.setValue("status", form.getValues("status")?.trim() || "pending")
    } else {
      form.setValue("status", undefined)
      form.clearErrors("status")
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    let body
    try {
      body = buildCommitmentCreatePayload({
        direction: values.direction,
        kind: values.kind,
        title: values.title.trim(),
        amountInput: values.amount,
        dueDate: values.dueDate,
        status: values.status,
        entityId: values.entityId,
        note: values.note,
      })
    } catch {
      form.setError("amount", { message: "Enter a valid amount" })
      return
    }

    try {
      const created = await createCommitment(body).unwrap()
      toast.success("Commitment saved")
      form.reset(commitmentFormDefaultValues())
      dismiss()
      onCreatedSuccess?.(created)
    } catch (err) {
      handleFormApiError(err, dispatch, { onDismiss: dismiss })
    }
  })

  const entityLabel =
    kindDef.entity.field === "none" ? null : kindDef.entity.selectLabel.replace(/^Select /i, "")

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Add Commitment"
      header={
        <header className={cn(APP_FORM_HEADER_CLASS, "flex items-start justify-between gap-2")}>
          <h2 id={titleId} className={APP_FORM_TITLE_CLASS}>
            Add Commitment
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
      formProps={{ onSubmit: (e) => void onSubmit(e) }}
      footer={
        <Button type="submit" disabled={isCreating} className={APP_FORM_SUBMIT_CLASS}>
          {isCreating ? "Saving…" : "Save Commitment"}
        </Button>
      }
    >
      <Form {...form}>
        <div className={APP_FORM_STACK_CLASS}>
          <div className={APP_FORM_TWO_COL_GRID_CLASS}>
            <FormField
              control={form.control}
              name="direction"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className={APP_FORM_LABEL_CLASS}>Direction</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <select
                        id="commitment-direction"
                        className={APP_FORM_SELECT_CLASS}
                        value={field.value}
                        onChange={(e) => setDirection(e.target.value as CommitmentDirection)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      >
                        {DIRECTIONS.map((d) => (
                          <option key={d.value} value={d.value}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className={APP_FORM_LABEL_CLASS}>Kind</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <select
                        id="commitment-kind"
                        className={APP_FORM_SELECT_CLASS}
                        value={field.value}
                        onChange={(e) => setKind(e.target.value as CommitmentKindValue)}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      >
                        {COMMITMENT_KIND_DEFINITIONS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                      <SelectChevron />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <AppFormInputField
              control={form.control}
              name="title"
              label="Title"
              autoComplete="off"
            />

            <AppFormInputField
              control={form.control}
              name="amount"
              label="Amount"
              inputMode="decimal"
              placeholder="0.00"
            />

            <AppFormInputField
              control={form.control}
              name="dueDate"
              label="Due Date"
              type="date"
              inputClassName={cn(APP_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
            />

            {showStatus ? (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className={APP_FORM_LABEL_CLASS}>Status</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <select
                          id="commitment-status"
                          className={APP_FORM_SELECT_CLASS}
                          value={field.value ?? "pending"}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        >
                          {PAYABLE_COMMITMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <SelectChevron />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            {showEntity ? (
              <FormField
                control={form.control}
                name="entityId"
                render={({ field }) => (
                  <FormItem className="space-y-1.5 sm:col-span-2">
                    <FormLabel htmlFor={entitySelectId} className={APP_FORM_LABEL_CLASS}>
                      {entityLabel ? `Select ${entityLabel}` : "Linked entity"}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <select
                          id={entitySelectId}
                          disabled={entityBusy}
                          className={cn(
                            APP_FORM_SELECT_CLASS,
                            !field.value && "text-muted-foreground"
                          )}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          ref={field.ref}
                        >
                          <option value="">
                            {entityBusy
                              ? "Loading…"
                              : kindDef.entity.field === "none"
                                ? ""
                                : kindDef.entity.placeholder}
                          </option>
                          {entityOptions.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <SelectChevron />
                      </div>
                    </FormControl>
                    {kindDef.entityHint ? (
                      <p className="text-[11px] text-muted-foreground">{kindDef.entityHint}</p>
                    ) : null}
                    {!entityBusy && entityOptions.length === 0 ? (
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        No {entityLabel ?? "options"} available — add one in Accounts first.
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                No linked entity required for this kind.
              </p>
            )}
          </div>

          <AppFormInputField control={form.control} name="note" label="Note" autoComplete="off" />
        </div>
      </Form>
    </FormDialog>
  )
}

/** Wrapper has no hooks — mounted subtree owns form state and resets on unmount when `open` is false. */
export function AddCommitmentModal({
  open,
  onOpenChange,
  onCreatedSuccess,
}: AddCommitmentModalProps) {
  if (!open) return null
  return (
    <AddCommitmentModalMounted
      open={open}
      onOpenChange={onOpenChange}
      onCreatedSuccess={onCreatedSuccess}
    />
  )
}
