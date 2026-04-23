import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, Plus, X } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Account } from "@/lib/api/account-schemas"
import { accountApiTypeOrKind, filterActiveAccounts } from "@/lib/api/account-schemas"
import {
  creditCardAvailableCreditInr,
  creditCardLimitInr,
  creditCardOutstandingInr,
} from "@/lib/api/credit-card-map"
import { getErrorMessage } from "@/lib/api/errors"
import type { CreateTransactionPayload } from "@/lib/api/schemas"
import { endUserSession } from "@/lib/auth/end-session"
import { formatCurrency } from "@/lib/format"
import {
  APP_FORM_AMOUNT_PRIMARY_CLASS,
  APP_FORM_FIELD_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SELECT_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_TITLE_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"
import { useAddTransactionMutation, useGetCreditCardsQuery } from "@/store/api/base-api"
import { useAppDispatch } from "@/store/hooks"
import {
  cardExpenseFormSchema,
  parseNonNegativeFee,
  parsePositiveAmount,
  type CardExpenseFormValues,
} from "@/lib/forms/credit-card-expense-schema"

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function cardSpendSelectLabel(account: Account): string {
  const rec = account as unknown as Record<string, unknown>
  const l4 = String(rec.last4Digits ?? "")
    .replace(/\D/g, "")
    .slice(-4)
  const name = account.name?.trim() || "Card"
  return l4.length === 4 ? `${name} ••••${l4}` : name
}

function SelectChevron({ compact }: { compact?: boolean }) {
  return (
    <ChevronDown
      className={cn(
        "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
        compact ? "right-2 size-3.5" : "right-2.5 size-4"
      )}
      aria-hidden
    />
  )
}

export type AddCardSpendSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When set, this card is selected when the sheet opens */
  account: Account | null
}

export function AddCardSpendSheet({ open, onOpenChange, account }: AddCardSpendSheetProps) {
  if (!open) return null
  return <AddCardSpendSheetInner open={open} defaultAccount={account} onOpenChange={onOpenChange} />
}

function AddCardSpendSheetInner({
  open,
  defaultAccount,
  onOpenChange,
}: {
  open: boolean
  defaultAccount: Account | null
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const titleId = useId()
  const amountId = useId()
  const categoryId = useId()
  const cardId = useId()
  const feeId = useId()
  const dateId = useId()
  const noteId = useId()
  const tagInputId = useId()

  const [addTransaction, { isLoading: isSubmitting }] = useAddTransactionMutation()
  const { data: creditCardsRaw = [], isLoading: cardsLoading } = useGetCreditCardsQuery()
  const creditCards = useMemo(() => filterActiveAccounts(creditCardsRaw), [creditCardsRaw])

  const [tagDraft, setTagDraft] = useState("")

  const form = useForm<CardExpenseFormValues>({
    resolver: zodResolver(cardExpenseFormSchema),
    defaultValues: {
      amount: "",
      category: "",
      creditCardAccountId: defaultAccount?.id ?? "",
      feeAmount: "",
      date: todayIsoDate(),
      note: "",
      tags: [],
    },
  })

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!defaultAccount?.id) return
    form.setValue("creditCardAccountId", defaultAccount.id)
  }, [defaultAccount?.id, form])

  useEffect(() => {
    if (cardsLoading || creditCards.length === 0) return
    const current = form.getValues("creditCardAccountId")
    if (current && creditCards.some((c) => c.id === current)) return
    const pick =
      defaultAccount?.id && creditCards.some((c) => c.id === defaultAccount.id)
        ? defaultAccount.id
        : creditCards[0]!.id
    form.setValue("creditCardAccountId", pick)
  }, [cardsLoading, creditCards, defaultAccount?.id, form])

  const selectedCardId = useWatch({ control: form.control, name: "creditCardAccountId" }) ?? ""
  const selectedCard = useMemo(
    () => creditCards.find((c) => c.id === selectedCardId) ?? null,
    [creditCards, selectedCardId]
  )

  const tags = useWatch({ control: form.control, name: "tags" }) ?? []

  const addTag = useCallback(() => {
    const next = tagDraft.trim()
    if (!next) return
    const cur = form.getValues("tags")
    if (cur.includes(next)) {
      setTagDraft("")
      return
    }
    form.setValue("tags", [...cur, next], { shouldValidate: true })
    setTagDraft("")
  }, [form, tagDraft])

  const removeTag = useCallback(
    (t: string) => {
      form.setValue(
        "tags",
        form.getValues("tags").filter((x) => x !== t),
        { shouldValidate: true }
      )
    },
    [form]
  )

  async function onValid(values: CardExpenseFormValues) {
    const amt = parsePositiveAmount(values.amount)
    if (amt == null) {
      toast.error("Enter a valid amount")
      return
    }
    const feeParsed = parseNonNegativeFee(values.feeAmount)
    if (feeParsed === null) {
      toast.error("Fee must be empty or a non-negative number")
      return
    }

    const card = creditCards.find((c) => c.id === values.creditCardAccountId)
    const cardLabel = card ? cardSpendSelectLabel(card) : "Card"

    const payload: CreateTransactionPayload = {
      type: "expense",
      amount: amt,
      category: values.category.trim(),
      creditCardAccountId: values.creditCardAccountId,
      payFromAccountType: card ? accountApiTypeOrKind(card) : "credit_card",
      paymentMethod: "card",
      sourceName: cardLabel,
      feeAmount: String(feeParsed),
      paidOnBehalf: false,
      scheduled: false,
      date: values.date,
      note: values.note,
      tags: values.tags,
      displayTitle: `Card · ${values.category.trim()}`,
      accountName: cardLabel,
    }

    try {
      await addTransaction(payload).unwrap()
      toast.success("Expense added")
      dismiss()
    } catch (err) {
      const msg = getErrorMessage(err)
      if (/authorization token is required/i.test(msg)) {
        toast.error("Session expired, please login again")
        endUserSession(dispatch)
        dismiss()
        navigate("/login", { replace: true })
        return
      }
      toast.error(msg)
    }
  }

  const limit = selectedCard ? creditCardLimitInr(selectedCard) : 0
  const used = selectedCard ? creditCardOutstandingInr(selectedCard) : 0
  const available = selectedCard ? creditCardAvailableCreditInr(selectedCard) : 0
  const limitKnown = limit > 0

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Add Card Spend"
      contentClassName="max-w-xl"
      header={
        <header className={cn(APP_FORM_HEADER_CLASS, "flex items-start justify-between gap-2")}>
          <h2 id={titleId} className={APP_FORM_TITLE_CLASS}>
            Add Card Spend
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
      formProps={{ onSubmit: form.handleSubmit(onValid) }}
      footer={
        <Button
          type="submit"
          disabled={isSubmitting || cardsLoading || creditCards.length === 0}
          className={APP_FORM_SUBMIT_CLASS}
        >
          {isSubmitting ? "Saving…" : "Add Card Spend"}
        </Button>
      }
    >
      <input type="hidden" name="type" value="expense" readOnly aria-hidden />

      <div className={APP_FORM_STACK_CLASS}>
        <section>
          <Label htmlFor={cardId} className={APP_FORM_LABEL_CLASS}>
            Credit card
          </Label>
          <div className="relative">
            <select
              id={cardId}
              disabled={cardsLoading || creditCards.length === 0}
              {...form.register("creditCardAccountId")}
              className={cn(
                APP_FORM_SELECT_CLASS,
                "pr-8",
                !selectedCardId && "text-muted-foreground"
              )}
            >
              <option value="">{cardsLoading ? "Loading cards…" : "Select credit card"}</option>
              {creditCards.map((c) => (
                <option key={c.id} value={c.id}>
                  {cardSpendSelectLabel(c)}
                </option>
              ))}
            </select>
            <SelectChevron compact />
          </div>
          {form.formState.errors.creditCardAccountId && (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.creditCardAccountId.message}
            </p>
          )}
        </section>

        {selectedCard && (
          <section>
            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/40 px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Available credit</span>
                <span
                  className={cn(
                    "font-bold tabular-nums",
                    !limitKnown && "text-muted-foreground",
                    limitKnown && available < 0 && "text-destructive",
                    limitKnown && available >= 0 && "text-foreground"
                  )}
                >
                  {limitKnown ? formatCurrency(available) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-2 text-xs sm:text-sm">
                <span className="text-muted-foreground">Used</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCurrency(used)}
                </span>
              </div>
            </div>
          </section>
        )}

        <section>
          <Label htmlFor={amountId} className={APP_FORM_LABEL_CLASS}>
            Amount (₹)
          </Label>
          <Input
            id={amountId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            aria-invalid={!!form.formState.errors.amount}
            {...form.register("amount")}
            className={APP_FORM_AMOUNT_PRIMARY_CLASS}
          />
          {form.formState.errors.amount && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.amount.message}</p>
          )}
        </section>

        <section>
          <Label htmlFor={categoryId} className={APP_FORM_LABEL_CLASS}>
            Category
          </Label>
          <Input
            id={categoryId}
            placeholder="e.g. food"
            autoComplete="off"
            aria-invalid={!!form.formState.errors.category}
            {...form.register("category")}
            className={APP_FORM_FIELD_CLASS}
          />
          {form.formState.errors.category && (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.category.message}
            </p>
          )}
        </section>

        <section>
          <Label htmlFor={feeId} className={APP_FORM_LABEL_CLASS}>
            Fee amount (₹)
          </Label>
          <Input
            id={feeId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0 (optional)"
            {...form.register("feeAmount")}
            className={APP_FORM_FIELD_CLASS}
          />
          <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">Leave empty for 0</p>
        </section>

        <section>
          <Label htmlFor={dateId} className={APP_FORM_LABEL_CLASS}>
            Date
          </Label>
          <Input
            id={dateId}
            type="date"
            aria-invalid={!!form.formState.errors.date}
            {...form.register("date")}
            className={APP_FORM_FIELD_CLASS}
          />
          {form.formState.errors.date && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.date.message}</p>
          )}
        </section>

        <section>
          <Label htmlFor={noteId} className={APP_FORM_LABEL_CLASS}>
            Note
          </Label>
          <Input
            id={noteId}
            placeholder="Optional"
            autoComplete="off"
            {...form.register("note")}
            className={APP_FORM_FIELD_CLASS}
          />
        </section>

        <section>
          <Label htmlFor={tagInputId} className={APP_FORM_LABEL_CLASS}>
            Tags
          </Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id={tagInputId}
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="Add tag"
              className={cn(APP_FORM_FIELD_CLASS, "min-w-32 flex-1")}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-10 min-h-10 shrink-0 rounded-xl px-3"
              onClick={addTag}
              aria-label="Add tag"
            >
              <Plus className="size-4" />
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1 pr-1 font-normal">
                  {t}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-muted"
                    aria-label={`Remove ${t}`}
                    onClick={() => removeTag(t)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </section>
      </div>
    </FormDialog>
  )
}
