import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, Tag, X } from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import type { Account } from "@/lib/api/account-schemas"
import { accountSelectLabel, filterActiveAccounts } from "@/lib/api/account-schemas"
import {
  billCycleLabelFromDay,
  creditCardLimitInr,
  paymentDueDayNumber,
} from "@/lib/api/credit-card-map"
import { getErrorMessage } from "@/lib/api/errors"
import type { CreateTransactionPayload } from "@/lib/api/schemas"
import { endUserSession } from "@/lib/auth/end-session"
import { formatCurrency } from "@/lib/format"
import { isLoanAccount } from "@/lib/api/loan-account-map"
import { assertSourceAccountCoversAmount } from "@/lib/validation/source-account-balance"
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
import { useAddTransactionMutation, useGetAccountsQuery } from "@/store/api/base-api"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

const TX_CATEGORIES = [
  "Food & dining",
  "Transport",
  "Shopping",
  "Bills & utilities",
  "Health",
  "Entertainment",
  "Salary",
  "Investments",
  "Transfer",
  "Other",
] as const

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseDecimalAmountInput(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function cardPaySelectLabel(account: Account): string {
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

export type PayCreditCardBillSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
}

export function PayCreditCardBillSheet({
  open,
  onOpenChange,
  account,
}: PayCreditCardBillSheetProps) {
  if (!open || !account) return null
  return <PayCreditCardBillSheetInner open={open} account={account} onOpenChange={onOpenChange} />
}

function PayCreditCardBillSheetInner({
  open,
  account,
  onOpenChange,
}: {
  open: boolean
  account: Account
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const titleId = useId()
  const amountId = useId()
  const dateId = useId()
  const noteId = useId()

  const {
    data: accountsRaw = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAccountsQuery(undefined, { skip: !user })

  const payingAccounts = useMemo(() => {
    return filterActiveAccounts(accountsRaw).filter((a) => !isLoanAccount(a) && a.id !== account.id)
  }, [accountsRaw, account.id])

  const [addTransaction, { isLoading: isSubmitting }] = useAddTransactionMutation()

  const [amount, setAmount] = useState("0")
  const [fromAccountId, setFromAccountId] = useState("")
  const [date, setDate] = useState(todayIsoDate)
  const [note, setNote] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagPreset, setTagPreset] = useState("")
  const [newTag, setNewTag] = useState("")

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  useEffect(() => {
    if (!isError || !error) return
    const msg = getErrorMessage(error)
    if (/authorization token is required/i.test(msg)) {
      toast.error("Session expired, please login again")
      endUserSession(dispatch)
      dismiss()
      navigate("/login", { replace: true })
    }
  }, [isError, error, dispatch, dismiss, navigate])

  function addTagFromInputs() {
    const fromPreset = tagPreset.trim()
    const fromNew = newTag.trim()
    const next = fromPreset || fromNew
    if (!next) return
    if (!tags.includes(next)) setTags((t) => [...t, next])
    setNewTag("")
    setTagPreset("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const amt = parseDecimalAmountInput(amount)
    if (amt == null) {
      toast.error("Enter a valid amount")
      return
    }
    if (!fromAccountId) {
      toast.error("Select paying account")
      return
    }

    const fromAcc = payingAccounts.find((a) => a.id === fromAccountId)
    if (!assertSourceAccountCoversAmount(fromAcc, amt)) {
      return
    }

    const cardName = account.name.trim() || "Card"
    const noteForApi = note.trim() || "Card bill payment"
    const tagsOut = tags.some((t) => t.toLowerCase() === "bill") ? tags : [...tags, "bill"]

    const payload: CreateTransactionPayload = {
      type: "transfer",
      amount: amt,
      category: "",
      transferDestination: "credit_card_bill",
      creditCardAccountId: account.id,
      paymentMethod: "account",
      sourceName: fromAcc?.name ?? "",
      feeAmount: "0",
      paidOnBehalf: false,
      scheduled: false,
      date,
      note: noteForApi,
      tags: tagsOut,
      displayTitle: `Credit card payment · ${cardName}`,
      accountId: fromAccountId,
      accountName: fromAcc?.name,
    }

    try {
      await addTransaction(payload).unwrap()
      toast.success("Card payment recorded")
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

  const limit = creditCardLimitInr(account)
  const dueDay = paymentDueDayNumber(account)
  const dueLabel = billCycleLabelFromDay(dueDay) ?? "—"
  const cardLabel = cardPaySelectLabel(account)

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Pay Credit Card Bill"
      contentClassName="max-w-xl"
      header={
        <header className={cn(APP_FORM_HEADER_CLASS, "flex items-start justify-between gap-2")}>
          <h2 id={titleId} className={APP_FORM_TITLE_CLASS}>
            Pay Credit Card Bill
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
      formProps={!isLoading && !isError ? { onSubmit: handleSubmit } : undefined}
      footer={
        !isLoading && !isError ? (
          <Button
            type="submit"
            disabled={isSubmitting || payingAccounts.length === 0}
            className={APP_FORM_SUBMIT_CLASS}
          >
            {isSubmitting ? "Saving…" : "Add Card Payment"}
          </Button>
        ) : null
      }
    >
      {isLoading && (
        <div className="space-y-2 px-4 py-3">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="px-4 py-4 text-center">
          <p className="text-sm text-destructive">{getErrorMessage(error)}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 rounded-xl"
            onClick={() => refetch()}
          >
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <div className={APP_FORM_STACK_CLASS}>
          <section>
            <Label htmlFor={amountId} className={APP_FORM_LABEL_CLASS}>
              Amount (₹)
            </Label>
            <Input
              id={amountId}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                const v = e.target.value
                if (v === "") {
                  setAmount("")
                  return
                }
                if (/^\d*\.?\d{0,2}$/.test(v)) {
                  setAmount(v)
                }
              }}
              className={APP_FORM_AMOUNT_PRIMARY_CLASS}
            />
          </section>

          <section>
            <Label className={APP_FORM_LABEL_CLASS}>Credit Card</Label>
            <div className="relative">
              <select
                disabled
                aria-disabled="true"
                value={account.id}
                className={cn(
                  APP_FORM_SELECT_CLASS,
                  "pr-8 opacity-90",
                  "cursor-not-allowed bg-muted/70"
                )}
              >
                <option value={account.id}>{cardLabel}</option>
              </select>
              <SelectChevron compact />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
              Pre-selected from card detail
            </p>
          </section>

          <section>
            <div className="space-y-0 rounded-xl border border-border/80 bg-muted/40 px-3 py-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Credit Limit</span>
                <span className="font-bold tabular-nums text-foreground">
                  {formatCurrency(limit)}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
                <span className="text-muted-foreground">Due Date</span>
                <span className="font-bold text-foreground">{dueLabel}</span>
              </div>
            </div>
          </section>

          <section>
            <Label className={APP_FORM_LABEL_CLASS}>Paying From (Account)</Label>
            <div className="relative">
              <select
                value={fromAccountId}
                onChange={(e) => setFromAccountId(e.target.value)}
                className={cn(
                  APP_FORM_SELECT_CLASS,
                  "pr-8",
                  !fromAccountId && "text-muted-foreground"
                )}
              >
                <option value="">Select account</option>
                {payingAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountSelectLabel(a)}
                  </option>
                ))}
              </select>
              <SelectChevron compact />
            </div>
          </section>

          <section>
            <Label htmlFor={dateId} className={APP_FORM_LABEL_CLASS}>
              Date
            </Label>
            <Input
              id={dateId}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={cn(APP_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
            />
          </section>

          <section>
            <Label htmlFor={noteId} className={APP_FORM_LABEL_CLASS}>
              Note
            </Label>
            <Input
              id={noteId}
              placeholder="What was this for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={APP_FORM_FIELD_CLASS}
            />
          </section>

          <section>
            <Label className={cn(APP_FORM_LABEL_CLASS, "flex items-center gap-1")}>
              <Tag className="size-3 sm:size-3.5" strokeWidth={2} aria-hidden />
              Tags
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <div className="relative min-w-0 flex-1 basis-[38%]">
                <select
                  value={tagPreset}
                  onChange={(e) => setTagPreset(e.target.value)}
                  className={cn(
                    APP_FORM_SELECT_CLASS,
                    "pr-8",
                    !tagPreset && "text-muted-foreground"
                  )}
                >
                  <option value="">Add tag…</option>
                  {TX_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <SelectChevron compact />
              </div>
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="New tag"
                className={cn(APP_FORM_FIELD_CLASS, "min-w-[5rem] flex-1")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTagFromInputs()
                  }
                }}
              />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                aria-label="Add tag"
                onClick={addTagFromInputs}
              >
                +
              </Button>
            </div>
            {tags.length > 0 ? (
              <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-[11px]">
                {tags.join(" · ")}
              </p>
            ) : null}
          </section>
        </div>
      )}
    </FormDialog>
  )
}
