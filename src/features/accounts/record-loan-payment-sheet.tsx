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
import { getErrorMessage } from "@/lib/api/errors"
import type { CreateTransactionPayload } from "@/lib/api/schemas"
import { endUserSession } from "@/lib/auth/end-session"
import { formatCurrency } from "@/lib/format"
import { interestRatePercentFromAccount } from "@/lib/api/credit-card-map"
import {
  isLoanAccount,
  loanPaymentComponentsForTotalInr,
  resolveLoanEmiAmount,
} from "@/lib/api/loan-account-map"
import { assertSourceAccountCoversAmount } from "@/lib/validation/source-account-balance"
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

const PAYMENT_TYPES = [
  { value: "regular_emi", label: "Regular EMI" },
  { value: "lump_sum", label: "Lump sum prepayment" },
] as const

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function formatEmiForAmountInput(emi: number): string {
  return (Math.round(emi * 100) / 100).toFixed(2)
}

function defaultAmountForMode(mode: LoanPaymentMode, account: Account | null): string {
  if (!account || mode !== "pay_emi") return ""
  const emi = resolveLoanEmiAmount(account)
  return emi != null ? formatEmiForAmountInput(emi) : ""
}

function parseDecimalAmountInput(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim()
  if (!t) return null
  const n = Number(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
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

export type LoanPaymentMode = "pay_emi" | "repay_emi"

export type RecordLoanPaymentSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  mode: LoanPaymentMode
}

export function RecordLoanPaymentSheet({
  open,
  onOpenChange,
  account,
  mode,
}: RecordLoanPaymentSheetProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)
  const titleId = useId()
  const amountId = useId()

  const {
    data: accountsRaw = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAccountsQuery(undefined, { skip: !user || !open })

  const payingAccounts = useMemo(() => {
    return filterActiveAccounts(accountsRaw).filter((a) => !isLoanAccount(a))
  }, [accountsRaw])

  const [addTransaction, { isLoading: isSubmitting }] = useAddTransactionMutation()

  const [amount, setAmount] = useState(() => defaultAmountForMode(mode, account))
  const [paymentType, setPaymentType] = useState<string>("regular_emi")
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
    if (!isError || !error || !open) return
    const msg = getErrorMessage(error)
    if (/authorization token is required/i.test(msg)) {
      toast.error("Session expired, please login again")
      endUserSession(dispatch)
      dismiss()
      navigate("/login", { replace: true })
    }
  }, [isError, error, open, dispatch, dismiss, navigate])

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
    if (!account) return

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

    const loanName = account.name.trim() || "Loan"
    const typeLabel = paymentType === "lump_sum" ? "Loan prepayment" : "Loan EMI"
    const noteForApi =
      [note.trim(), `${typeLabel}: ${loanName}`].filter(Boolean).join(" — ") ||
      `${typeLabel}: ${loanName}`
    const tagsOut =
      paymentType === "lump_sum"
        ? tags.includes("prepayment")
          ? tags
          : [...tags, "prepayment"]
        : tags.includes("emi")
          ? tags
          : [...tags, "emi"]

    const split = loanPaymentComponentsForTotalInr(
      account,
      amt,
      paymentType === "lump_sum" ? "all_principal" : "schedule_based"
    )

    const payload: CreateTransactionPayload = {
      type: "transfer",
      amount: amt,
      category: "",
      transferDestination: "loan_emi",
      loanAccountId: account.id,
      principalComponent: split.principalInr,
      interestComponent: split.interestInr,
      paymentMethod: "account",
      sourceName: fromAcc?.name ?? "",
      feeAmount: "0",
      paidOnBehalf: false,
      scheduled: false,
      date,
      note: noteForApi,
      tags: tagsOut,
      displayTitle: `${typeLabel} · ${loanName}`,
      accountId: fromAccountId,
      accountName: fromAcc?.name,
    }

    try {
      await addTransaction(payload).unwrap()
      toast.success("Loan payment recorded")
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

  if (!open || !account) return null

  const emi = resolveLoanEmiAmount(account)
  const rate = interestRatePercentFromAccount(account)
  const loanSelectLabel =
    emi != null ? `${account.name} — EMI ${formatCurrency(emi)}` : account.name

  const fieldBase = cn(
    "w-full rounded-xl border border-border bg-muted/50 text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
    "h-9 px-2.5 text-xs sm:h-10 sm:px-3 sm:text-sm"
  )

  const lb = "mb-0.5 block text-[10px] font-bold text-primary sm:text-xs"

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Record Loan Payment"
      contentClassName="max-w-xl"
      header={
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-4">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
            Record Loan Payment
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
            className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] sm:h-11 sm:text-base"
          >
            {isSubmitting ? "Saving…" : "Add Loan Payment"}
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
        <div className="space-y-3 px-4 py-3 sm:space-y-3.5 sm:py-4">
          <section>
            <Label htmlFor={amountId} className={lb}>
              Amount (₹)
            </Label>
            <Input
              id={amountId}
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d.]/g, "")
                const d = v.indexOf(".")
                if (d === -1) {
                  setAmount(v)
                  return
                }
                const intPart = v.slice(0, d).replace(/\./g, "")
                const frac = v
                  .slice(d + 1)
                  .replace(/\./g, "")
                  .slice(0, 2)
                setAmount(frac.length > 0 ? `${intPart}.${frac}` : `${intPart}.`)
              }}
              placeholder="0.00"
              className={cn(
                "h-12 rounded-xl border-2 border-primary bg-card px-3 text-center text-lg font-bold tabular-nums shadow-sm sm:h-14 sm:text-xl",
                "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              )}
            />
          </section>

          <section>
            <Label className={lb}>Select Loan</Label>
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
                <option value={account.id}>{loanSelectLabel}</option>
              </select>
              <SelectChevron compact />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground sm:text-[11px]">
              Pre-selected from loan detail
            </p>
          </section>

          {(emi != null || rate != null) && (
            <div className="rounded-xl border border-border/80 bg-muted/40 px-3 py-3 text-sm">
              {emi != null ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">EMI Amount</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {formatCurrency(emi)}
                  </span>
                </div>
              ) : null}
              {rate != null ? (
                <div
                  className={cn(
                    "flex items-center justify-between gap-2",
                    emi != null ? "mt-2 border-t border-border/60 pt-2" : ""
                  )}
                >
                  <span className="text-muted-foreground">Rate</span>
                  <span className="font-bold tabular-nums text-foreground">
                    {rate % 1 === 0 ? String(Math.round(rate)) : rate.toFixed(1)}%
                  </span>
                </div>
              ) : null}
            </div>
          )}

          <section>
            <Label className={lb}>Payment Type</Label>
            <div className="relative">
              <select
                value={paymentType}
                onChange={(e) => setPaymentType(e.target.value)}
                className={cn(fieldBase, "appearance-none pr-8")}
              >
                {PAYMENT_TYPES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <SelectChevron compact />
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
            <Label htmlFor="loan-pay-date" className={lb}>
              Date
            </Label>
            <Input
              id="loan-pay-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={fieldBase}
            />
          </section>

          <section>
            <Label htmlFor="loan-pay-note" className={lb}>
              Note
            </Label>
            <textarea
              id="loan-pay-note"
              rows={2}
              placeholder="What was this for?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={cn(
                "min-h-[4.5rem] w-full resize-none rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-foreground shadow-sm outline-none",
                "placeholder:text-muted-foreground/80",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
              )}
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
    </FormDialog>
  )
}
