import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDays, ChevronDown, Tag, X } from "lucide-react"
import { toast } from "sonner"
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
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
import { formatCurrency } from "@/lib/format"
import { isLoanAccount } from "@/lib/api/loan-account-map"
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
  return <PayCreditCardBillSheetInner account={account} onOpenChange={onOpenChange} />
}

function PayCreditCardBillSheetInner({
  account,
  onOpenChange,
}: {
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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [dismiss])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

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

  const fieldBase = cn(
    "w-full rounded-xl border border-border bg-muted/50 text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
    "h-9 px-2.5 text-xs sm:h-10 sm:px-3 sm:text-sm"
  )

  const lb = "mb-0.5 block text-[10px] font-bold text-primary sm:text-xs"

  return (
    <div className="fixed inset-0 z-[70] flex min-h-0 max-h-dvh items-center justify-center overflow-hidden p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close overlay"
        onClick={dismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex min-h-0 max-h-[min(calc(100dvh-1.25rem-env(safe-area-inset-bottom)),92dvh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-4">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading && (
            <div className={cn(FORM_OVERLAY_SCROLL_BODY, "space-y-2 px-4 py-3")}>
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          )}

          {isError && !isLoading && (
            <div className={cn(FORM_OVERLAY_SCROLL_BODY, "px-4 py-4 text-center")}>
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
            <div
              className={cn(FORM_OVERLAY_SCROLL_BODY, "space-y-3 px-4 py-3 sm:space-y-3.5 sm:py-4")}
            >
              <section>
                <Label htmlFor={amountId} className={lb}>
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
                  className={cn(
                    "h-12 rounded-xl border-2 border-primary bg-card px-3 text-center text-lg font-bold tabular-nums shadow-sm sm:h-14 sm:text-xl",
                    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30",
                    "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-auto [&::-webkit-outer-spin-button]:appearance-auto"
                  )}
                />
              </section>

              <section>
                <Label className={lb}>Credit Card</Label>
                <div className="relative">
                  <select
                    disabled
                    aria-disabled="true"
                    value={account.id}
                    className={cn(
                      fieldBase,
                      "appearance-none pr-8 opacity-90",
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
                <Label className={lb}>Paying From (Account)</Label>
                <div className="relative">
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className={cn(
                      fieldBase,
                      "appearance-none pr-8",
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
                <Label htmlFor={dateId} className={lb}>
                  Date
                </Label>
                <div className="relative">
                  <Input
                    id={dateId}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={cn(fieldBase, "pr-10")}
                  />
                  <CalendarDays
                    className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              </section>

              <section>
                <Label htmlFor={noteId} className={lb}>
                  Note
                </Label>
                <Input
                  id={noteId}
                  placeholder="What was this for?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={fieldBase}
                />
              </section>

              <section>
                <Label className={cn(lb, "flex items-center gap-1")}>
                  <Tag className="size-3 sm:size-3.5" strokeWidth={2} aria-hidden />
                  Tags
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  <div className="relative min-w-0 flex-1 basis-[38%]">
                    <select
                      value={tagPreset}
                      onChange={(e) => setTagPreset(e.target.value)}
                      className={cn(
                        fieldBase,
                        "appearance-none pr-8",
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
                    className={cn(fieldBase, "min-w-[5rem] flex-1")}
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
                    className="size-9 shrink-0 rounded-xl"
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

          {!isLoading && !isError && (
            <div className={FORM_OVERLAY_FOOTER}>
              <Button
                type="submit"
                disabled={isSubmitting || payingAccounts.length === 0}
                className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] sm:h-11 sm:text-base"
              >
                {isSubmitting ? "Saving…" : "Add Card Payment"}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
