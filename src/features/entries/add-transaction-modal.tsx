import { useEffect, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDays, ChevronDown, CreditCard, Gem, Landmark, Tag, X } from "lucide-react"
import { toast } from "sonner"
import { ToggleTile } from "@/components/toggle-tile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { accountSelectLabel, filterActiveAccounts, type Account } from "@/lib/api/account-schemas"
import {
  creditCardMinimumPaymentInr,
  interestRatePercentFromAccount,
  isCreditCardAccount,
} from "@/lib/api/credit-card-map"
import { getErrorMessage } from "@/lib/api/errors"
import {
  isLoanAccount,
  loanNextEmiInterestInr,
  loanNextEmiPrincipalInr,
  loanOutstandingInr,
  loanPrincipalInr,
  resolveLoanEmiAmount,
} from "@/lib/api/loan-account-map"
import { INCOME_SOURCE_OPTIONS } from "@/lib/api/transaction-schemas"
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
import type { TransactionType, TransferDestinationType } from "@/lib/api/schemas"
import { formatCurrency } from "@/lib/format"
import { assertSourceAccountCoversAmount } from "@/lib/validation/source-account-balance"
import { cn } from "@/lib/utils"
import { useAddTransactionMutation, useGetAccountsQuery } from "@/store/api/base-api"
import { useAppSelector } from "@/store/hooks"

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

type PaymentMethod = "account" | "card"

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function sanitizeDecimalInput(raw: string): string {
  const t = raw.replace(/[^\d.]/g, "")
  const dot = t.indexOf(".")
  if (dot === -1) return t
  const int = t.slice(0, dot)
  const dec = t
    .slice(dot + 1)
    .replace(/\./g, "")
    .slice(0, 2)
  return dec.length > 0 ? `${int}.${dec}` : `${int}.`
}

function parseDecimalInput(s: string): number {
  const t = s.trim().replace(/,/g, "")
  if (!t) return 0
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

function formatInr2(n: number): string {
  if (!Number.isFinite(n)) return "0.00"
  return n.toFixed(2)
}

/** en-IN ₹ with up to 2 decimals (EMI / split lines). */
function formatLoanRupee(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Pure prefill from loan account API fields (no setState — used in useMemo + optional overrides). */
function computeLoanPrefillStrings(loan: Account): { principal: string; interest: string } {
  const int = loanNextEmiInterestInr(loan)
  const pr = loanNextEmiPrincipalInr(loan)
  if (int != null && int > 0) {
    const interestStr = formatInr2(int)
    if (pr != null && pr > 0) {
      return { principal: formatInr2(pr), interest: interestStr }
    }
    const emi = resolveLoanEmiAmount(loan)
    if (emi != null && emi > int) {
      return {
        principal: formatInr2(Math.round((emi - int) * 100) / 100),
        interest: interestStr,
      }
    }
    return { principal: "", interest: interestStr }
  }
  if (pr != null && pr > 0) {
    return { principal: formatInr2(pr), interest: "" }
  }
  return { principal: "", interest: "" }
}

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

function NoAccountsEmptyState({ onAddAccount }: { onAddAccount: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/80">
        <Landmark className="size-8 text-primary" strokeWidth={2} aria-hidden />
      </div>
      <p className="text-base font-bold text-primary">No account found</p>
      <p className="mt-2 max-w-[18rem] text-sm text-muted-foreground">
        Add a bank account, cash, or wallet to start tracking
      </p>
      <Button
        type="button"
        className="mt-6 h-11 w-full max-w-56 rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
        onClick={onAddAccount}
      >
        Add Account
      </Button>
    </div>
  )
}

/** Pay Bill / Pay EMI from account detail — same UI as Transfer with target locked. */
export type TransferPaymentPreset =
  | { kind: "credit_card_bill"; creditCardAccountId: string }
  | { kind: "loan_emi"; loanAccountId: string }

export type AddTransactionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Expenses tab flow: locked expense type, “Add Expense”, note-first title. */
  expenseFlow?: boolean
  /**
   * Initial type when the modal opens (same shell as Add Transaction).
   * Use `"transfer"` when opening from “Add Transfer”.
   */
  initialType?: TransactionType
  /** When set, “Add Account” opens the shared Accounts sheet instead of navigating away. */
  onOpenAddAccount?: () => void
  /**
   * Lock to transfer + card bill or loan EMI with target account pre-filled (Accounts Pay Bill / Pay EMI).
   * Parent should set `initialType="transfer"` and clear when modal closes.
   */
  transferPaymentPreset?: TransferPaymentPreset | null
}

type MountedProps = {
  onOpenChange: (open: boolean) => void
  expenseFlow: boolean
  initialType: TransactionType
  onOpenAddAccount?: () => void
  transferPaymentPreset: TransferPaymentPreset | null
}

function AddTransactionModalMounted({
  onOpenChange,
  expenseFlow,
  initialType,
  onOpenAddAccount,
  transferPaymentPreset,
}: MountedProps) {
  const lockTransferPayment = transferPaymentPreset != null
  const titleId = useId()
  const categoryId = useId()
  const incomeSourceId = useId()
  const accountIdField = useId()
  const toAccountIdField = useId()
  const transferDestinationTypeId = useId()
  const creditCardAccountFieldId = useId()
  const loanAccountFieldId = useId()
  const loanPrincipalFieldId = useId()
  const loanInterestFieldId = useId()
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)

  const {
    data: accountsRaw = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAccountsQuery(undefined, { skip: !user })

  const accounts = useMemo(() => filterActiveAccounts(accountsRaw), [accountsRaw])

  const transferSourceAccounts = useMemo(
    () => accounts.filter((a) => !isLoanAccount(a) && !isCreditCardAccount(a)),
    [accounts]
  )
  const creditCardAccounts = useMemo(() => accounts.filter(isCreditCardAccount), [accounts])
  const loanAccounts = useMemo(() => accounts.filter(isLoanAccount), [accounts])

  const [addTransaction, { isLoading: isSubmitting }] = useAddTransactionMutation()

  const [txType, setTxType] = useState<TransactionType>(() =>
    expenseFlow ? "expense" : lockTransferPayment ? "transfer" : initialType
  )
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(todayIsoDate)
  const [category, setCategory] = useState("")
  const [incomeSource, setIncomeSource] = useState<string>("salary")
  const [accountId, setAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [creditCardAccountId, setCreditCardAccountId] = useState(() =>
    transferPaymentPreset?.kind === "credit_card_bill"
      ? transferPaymentPreset.creditCardAccountId
      : ""
  )
  const [loanAccountId, setLoanAccountId] = useState(() =>
    transferPaymentPreset?.kind === "loan_emi" ? transferPaymentPreset.loanAccountId : ""
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("account")
  const [paidOnBehalf, setPaidOnBehalf] = useState(false)
  const [scheduleUpcoming, setScheduleUpcoming] = useState(false)
  const [note, setNote] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagPreset, setTagPreset] = useState("")
  const [newTag, setNewTag] = useState("")
  /** Transfer only — drives which destination field is shown. */
  const [transferDestinationType, setTransferDestinationType] = useState<TransferDestinationType>(
    () =>
      transferPaymentPreset?.kind === "credit_card_bill"
        ? "credit_card_bill"
        : transferPaymentPreset?.kind === "loan_emi"
          ? "loan_emi"
          : "account"
  )
  const [payMinimum, setPayMinimum] = useState(false)
  /** User edits to principal/interest; `undefined` field = use derived prefill from selected loan. */
  const [loanFieldOverride, setLoanFieldOverride] = useState<{
    principal?: string
    interest?: string
  } | null>(null)

  const effectiveType: TransactionType = expenseFlow ? "expense" : txType
  const hasAccount = accounts.length > 0

  const selectedCreditCardAccount = useMemo(() => {
    const fromList = creditCardAccounts.find((c) => c.id === creditCardAccountId)
    if (fromList) return fromList
    const a = accounts.find((x) => x.id === creditCardAccountId)
    return a && isCreditCardAccount(a) ? a : undefined
  }, [creditCardAccounts, creditCardAccountId, accounts])
  const minimumDueInr = useMemo(
    () =>
      selectedCreditCardAccount ? creditCardMinimumPaymentInr(selectedCreditCardAccount) : null,
    [selectedCreditCardAccount]
  )

  const selectedLoanAccount = useMemo(() => {
    const fromList = loanAccounts.find((l) => l.id === loanAccountId)
    if (fromList) return fromList
    const a = accounts.find((x) => x.id === loanAccountId)
    return a && isLoanAccount(a) ? a : null
  }, [loanAccounts, loanAccountId, accounts])

  const loanPrefillFromSelectedAccount = useMemo(
    () =>
      selectedLoanAccount
        ? computeLoanPrefillStrings(selectedLoanAccount)
        : { principal: "", interest: "" },
    [selectedLoanAccount]
  )

  const loanPrincipalStr =
    loanFieldOverride?.principal !== undefined
      ? loanFieldOverride.principal
      : loanPrefillFromSelectedAccount.principal

  const loanInterestStr =
    loanFieldOverride?.interest !== undefined
      ? loanFieldOverride.interest
      : loanPrefillFromSelectedAccount.interest

  const loanTotalInr = useMemo(() => {
    const p = parseDecimalInput(loanPrincipalStr)
    const i = parseDecimalInput(loanInterestStr)
    return Math.round((p + i) * 100) / 100
  }, [loanPrincipalStr, loanInterestStr])

  const loanScheduleSummary = useMemo(() => {
    const a = selectedLoanAccount
    if (!a) return null
    const emi = resolveLoanEmiAmount(a)
    const rate = interestRatePercentFromAccount(a)
    const interestThisMonth = loanNextEmiInterestInr(a)
    const principalThisMonth = loanNextEmiPrincipalInr(a)
    const totalLoanPrincipal = loanPrincipalInr(a)
    const outstanding = loanOutstandingInr(a)
    const installmentTotal =
      emi != null
        ? emi
        : principalThisMonth != null || interestThisMonth != null
          ? Math.round(((principalThisMonth ?? 0) + (interestThisMonth ?? 0)) * 100) / 100
          : null
    return {
      emi,
      rate,
      interestThisMonth,
      principalThisMonth,
      installmentTotal,
      totalLoanPrincipal,
      outstanding,
    }
  }, [selectedLoanAccount])

  const loanBreakdownVisible = useMemo(() => {
    if (!loanScheduleSummary) return false
    const s = loanScheduleSummary
    return (
      (s.emi != null && s.emi > 0) ||
      (s.rate != null && Number.isFinite(s.rate)) ||
      (s.principalThisMonth != null && s.principalThisMonth > 0) ||
      (s.interestThisMonth != null && s.interestThisMonth > 0) ||
      (s.installmentTotal != null && s.installmentTotal > 0 && !(s.emi != null && s.emi > 0)) ||
      s.totalLoanPrincipal > 0 ||
      s.outstanding > 0
    )
  }, [loanScheduleSummary])

  function resetTransferDependentState() {
    setToAccountId("")
    if (!lockTransferPayment) {
      setCreditCardAccountId("")
      setLoanAccountId("")
    } else if (transferPaymentPreset?.kind === "credit_card_bill") {
      setLoanAccountId("")
      setCreditCardAccountId(transferPaymentPreset.creditCardAccountId)
    } else if (transferPaymentPreset?.kind === "loan_emi") {
      setCreditCardAccountId("")
      setLoanAccountId(transferPaymentPreset.loanAccountId)
    }
    setAmount("")
    setPayMinimum(false)
    setLoanFieldOverride(null)
  }

  const creditCardSelectOptions = useMemo(() => {
    const list = [...creditCardAccounts]
    if (
      lockTransferPayment &&
      transferPaymentPreset?.kind === "credit_card_bill" &&
      creditCardAccountId &&
      !list.some((c) => c.id === creditCardAccountId)
    ) {
      const a = accounts.find((x) => x.id === creditCardAccountId)
      if (a && isCreditCardAccount(a)) list.push(a)
    }
    return list
  }, [
    creditCardAccounts,
    accounts,
    lockTransferPayment,
    transferPaymentPreset,
    creditCardAccountId,
  ])

  const loanSelectOptions = useMemo(() => {
    const list = [...loanAccounts]
    if (
      lockTransferPayment &&
      transferPaymentPreset?.kind === "loan_emi" &&
      loanAccountId &&
      !list.some((l) => l.id === loanAccountId)
    ) {
      const a = accounts.find((x) => x.id === loanAccountId)
      if (a && isLoanAccount(a)) list.push(a)
    }
    return list
  }, [loanAccounts, accounts, lockTransferPayment, transferPaymentPreset, loanAccountId])

  const modalTitle = expenseFlow ? "Add Expense" : "Add Transaction"
  const submitLabel = expenseFlow ? "Add Expense" : "Add Transaction"

  function dismiss() {
    onOpenChange(false)
  }

  useEffect(() => {
    if (!isError || !error) return
    const msg = getErrorMessage(error)
    if (/authorization token is required/i.test(msg)) {
      toast.error(msg)
      onOpenChange(false)
      navigate("/login", { replace: true })
    }
  }, [isError, error, navigate, onOpenChange])

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
    if (!hasAccount) return

    let titleBase: string
    if (expenseFlow) {
      titleBase = note.trim()
      if (!titleBase) {
        toast.error("Add a note (what was this for?)")
        return
      }
    } else if (effectiveType === "transfer") {
      titleBase = note.trim() || "Transfer"
    } else {
      titleBase = description.trim()
      if (!titleBase) {
        toast.error("Add a description")
        return
      }
    }

    if (effectiveType !== "transfer") {
      const n = amount.replace(/\D/g, "")
      if (!n || Number(n) <= 0) {
        toast.error("Enter a valid amount")
        return
      }
    }
    if (effectiveType === "expense" && !category) {
      toast.error("Select a category")
      return
    }
    if (effectiveType === "income" && !incomeSource) {
      toast.error("Select income source")
      return
    }
    if (!accountId) {
      toast.error(effectiveType === "transfer" ? "Select source account" : "Select an account")
      return
    }
    if (effectiveType === "transfer") {
      if (transferDestinationType === "account") {
        if (!toAccountId) {
          toast.error("Select destination account")
          return
        }
        if (toAccountId === accountId) {
          toast.error("Choose a different account to transfer to")
          return
        }
        const n = amount.replace(/\D/g, "")
        if (!n || Number(n) <= 0) {
          toast.error("Enter a valid amount")
          return
        }
      } else if (transferDestinationType === "credit_card_bill") {
        if (!creditCardAccountId) {
          toast.error("Select credit card")
          return
        }
        if (payMinimum) {
          const m = selectedCreditCardAccount
            ? creditCardMinimumPaymentInr(selectedCreditCardAccount)
            : null
          if (m == null || m <= 0) {
            toast.error("Minimum due is not available for this card")
            return
          }
        } else {
          const n = amount.replace(/\D/g, "")
          if (!n || Number(n) <= 0) {
            toast.error("Enter a valid amount")
            return
          }
        }
      } else if (transferDestinationType === "loan_emi") {
        if (!loanAccountId) {
          toast.error("Select loan account")
          return
        }
        if (!(loanTotalInr > 0)) {
          toast.error("Enter principal and/or interest so the total is greater than zero")
          return
        }
      }
    }

    let submitAmountNum: number
    if (effectiveType === "transfer") {
      if (transferDestinationType === "credit_card_bill" && payMinimum) {
        submitAmountNum = minimumDueInr ?? 0
      } else if (transferDestinationType === "loan_emi") {
        submitAmountNum = loanTotalInr
      } else {
        submitAmountNum = Number(amount.replace(/\D/g, ""))
      }
    } else {
      submitAmountNum = Number(amount.replace(/\D/g, ""))
    }

    const acc = accounts.find((a) => a.id === accountId)
    if (effectiveType !== "income" && !assertSourceAccountCoversAmount(acc, submitAmountNum)) {
      return
    }

    const displayTitle = [titleBase, ...tags].filter(Boolean).join(" · ")
    const noteForApi = expenseFlow
      ? note.trim()
      : effectiveType === "transfer"
        ? note.trim()
        : [description.trim(), note.trim()].filter(Boolean).join(" — ")

    const payload = {
      type: effectiveType,
      amount: submitAmountNum,
      category: effectiveType === "expense" ? category : "",
      incomeSource: effectiveType === "income" ? incomeSource : undefined,
      toAccountId:
        effectiveType === "transfer" && transferDestinationType === "account"
          ? toAccountId
          : undefined,
      creditCardAccountId:
        effectiveType === "transfer" && transferDestinationType === "credit_card_bill"
          ? creditCardAccountId
          : undefined,
      loanAccountId:
        effectiveType === "transfer" && transferDestinationType === "loan_emi"
          ? loanAccountId
          : undefined,
      principalComponent:
        effectiveType === "transfer" && transferDestinationType === "loan_emi"
          ? parseDecimalInput(loanPrincipalStr)
          : undefined,
      interestComponent:
        effectiveType === "transfer" && transferDestinationType === "loan_emi"
          ? parseDecimalInput(loanInterestStr)
          : undefined,
      transferDestination: effectiveType === "transfer" ? transferDestinationType : undefined,
      paymentMethod,
      sourceName: acc?.name ?? "",
      feeAmount: "0",
      paidOnBehalf,
      scheduled: scheduleUpcoming,
      date,
      note: noteForApi,
      tags,
      displayTitle,
      accountId,
      accountName: acc?.name,
    }

    console.log("[add-transaction] submit — CreateTransactionPayload:", payload)

    try {
      await addTransaction(payload).unwrap()
      toast.success(
        expenseFlow
          ? "Expense added"
          : effectiveType === "transfer"
            ? "Transfer added"
            : "Transaction added"
      )
      dismiss()
    } catch (err) {
      console.error("[transactions] submit error", err)
      toast.error(getErrorMessage(err))
    }
  }

  const fromAccountLabel = expenseFlow
    ? "Paying from"
    : effectiveType === "income"
      ? "Receiving to"
      : effectiveType === "transfer"
        ? "From account"
        : "Paying from"

  const selectFieldClass = cn(
    "h-8 w-full appearance-none rounded-xl border border-border bg-card px-2.5 pr-8 text-xs text-foreground shadow-sm outline-none sm:h-9 sm:px-3 sm:pr-9 sm:text-sm",
    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
  )

  return (
    <div className="fixed inset-0 z-60 flex min-h-0 max-h-dvh items-center justify-center overflow-hidden p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
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
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
            {modalTitle}
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

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading && (
            <div className={cn(FORM_OVERLAY_SCROLL_BODY, "space-y-2 px-4 py-3")}>
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
              <Skeleton className="h-9 w-full rounded-xl" />
            </div>
          )}

          {isError && !isLoading && (
            <div
              className={cn(
                FORM_OVERLAY_SCROLL_BODY,
                "flex flex-col items-center justify-center gap-2 px-4 py-4 text-center"
              )}
            >
              <p className="text-xs text-destructive">{getErrorMessage(error)}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !isError && accounts.length === 0 && (
            <div className={cn(FORM_OVERLAY_SCROLL_BODY, "flex flex-col justify-center px-2 py-2")}>
              <NoAccountsEmptyState
                onAddAccount={() => {
                  dismiss()
                  if (onOpenAddAccount) onOpenAddAccount()
                  else navigate("/accounts")
                }}
              />
            </div>
          )}

          {!isLoading && !isError && hasAccount && (
            <form
              id="add-transaction-form"
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div
                className={cn(FORM_OVERLAY_SCROLL_BODY, "space-y-1 px-3 py-1.5 sm:px-4 sm:py-2")}
              >
                {!expenseFlow && !lockTransferPayment && (
                  <section>
                    <Label className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs">
                      Type
                    </Label>
                    <div className="grid grid-cols-3 gap-1">
                      {(
                        [
                          { id: "expense" as const, label: "Expense" },
                          { id: "income" as const, label: "Income" },
                          { id: "transfer" as const, label: "Transfer" },
                        ] as const
                      ).map(({ id, label }) => (
                        <ToggleTile
                          key={id}
                          selected={txType === id}
                          onClick={() => {
                            setTxType(id)
                          }}
                          className={cn(
                            txType === id &&
                              id === "expense" &&
                              "border-primary bg-sky-50 text-destructive dark:bg-primary/10 dark:text-destructive",
                            txType === id &&
                              id === "income" &&
                              "border-primary bg-sky-50 text-income dark:bg-primary/10",
                            txType === id &&
                              id === "transfer" &&
                              "border-primary bg-sky-50 text-primary dark:bg-primary/15"
                          )}
                        >
                          <span>{label}</span>
                        </ToggleTile>
                      ))}
                    </div>
                  </section>
                )}

                {effectiveType === "transfer" ? (
                  <>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <section>
                        <Label
                          htmlFor={accountIdField}
                          className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                        >
                          {fromAccountLabel}
                        </Label>
                        <div className="relative">
                          <select
                            id={accountIdField}
                            value={accountId}
                            onChange={(e) => {
                              const v = e.target.value
                              setAccountId(v)
                              if (toAccountId === v) setToAccountId("")
                            }}
                            className={cn(selectFieldClass, !accountId && "text-muted-foreground")}
                          >
                            <option value="">Select account</option>
                            {transferSourceAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {accountSelectLabel(a)}
                              </option>
                            ))}
                          </select>
                          <SelectChevron />
                        </div>
                      </section>
                      <section>
                        <Label
                          htmlFor={transferDestinationTypeId}
                          className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                        >
                          Destination type
                        </Label>
                        <div className="relative">
                          <select
                            id={transferDestinationTypeId}
                            value={transferDestinationType}
                            onChange={(e) => {
                              const v = e.target.value as TransferDestinationType
                              setTransferDestinationType(v)
                              resetTransferDependentState()
                            }}
                            disabled={lockTransferPayment}
                            className={cn(
                              selectFieldClass,
                              lockTransferPayment && "cursor-not-allowed opacity-80"
                            )}
                            aria-label="Transfer destination"
                          >
                            <option value="account">Account</option>
                            <option value="credit_card_bill">Credit card bill</option>
                            <option value="loan_emi">Loan payment</option>
                          </select>
                          <SelectChevron />
                        </div>
                      </section>
                    </div>

                    {transferDestinationType === "account" ? (
                      <section>
                        <Label
                          htmlFor={toAccountIdField}
                          className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                        >
                          To account
                        </Label>
                        <div className="relative">
                          <select
                            id={toAccountIdField}
                            value={toAccountId}
                            onChange={(e) => setToAccountId(e.target.value)}
                            className={cn(
                              selectFieldClass,
                              !toAccountId && "text-muted-foreground"
                            )}
                          >
                            <option value="">Select account</option>
                            {transferSourceAccounts
                              .filter((a) => a.id !== accountId)
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {accountSelectLabel(a)}
                                </option>
                              ))}
                          </select>
                          <SelectChevron />
                        </div>
                      </section>
                    ) : transferDestinationType === "credit_card_bill" ? (
                      <>
                        <section>
                          <Label
                            htmlFor={creditCardAccountFieldId}
                            className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                          >
                            Credit card
                          </Label>
                          <div className="relative">
                            <select
                              id={creditCardAccountFieldId}
                              value={creditCardAccountId}
                              onChange={(e) => setCreditCardAccountId(e.target.value)}
                              disabled={
                                lockTransferPayment &&
                                transferPaymentPreset?.kind === "credit_card_bill"
                              }
                              className={cn(
                                selectFieldClass,
                                !creditCardAccountId && "text-muted-foreground",
                                lockTransferPayment &&
                                  transferPaymentPreset?.kind === "credit_card_bill" &&
                                  "cursor-not-allowed opacity-80"
                              )}
                            >
                              <option value="">
                                {creditCardSelectOptions.length === 0
                                  ? "No credit cards — add in Accounts"
                                  : "Select card"}
                              </option>
                              {creditCardSelectOptions.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {accountSelectLabel(a)}
                                </option>
                              ))}
                            </select>
                            <SelectChevron />
                          </div>
                        </section>
                        <div className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/20 px-2.5 py-2 sm:px-3">
                          <span className="text-[11px] font-bold text-primary sm:text-xs">
                            Pay minimum?
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground sm:text-xs">
                              {payMinimum ? "Yes" : "No"}
                            </span>
                            <Switch
                              checked={payMinimum}
                              onCheckedChange={(on) => {
                                setPayMinimum(on)
                                if (on) setAmount("")
                              }}
                              aria-label="Pay minimum amount"
                            />
                          </div>
                        </div>
                        <section>
                          <Label
                            htmlFor="at-minimum-due-transfer"
                            className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                          >
                            Minimum amount
                          </Label>
                          <Input
                            id="at-minimum-due-transfer"
                            readOnly
                            value={
                              minimumDueInr != null && minimumDueInr > 0
                                ? formatInr2(minimumDueInr)
                                : "0.00"
                            }
                            className="h-8 rounded-xl border-border bg-muted/60 px-2.5 text-xs tabular-nums text-muted-foreground shadow-sm sm:h-9 sm:px-3 sm:text-sm"
                          />
                        </section>
                      </>
                    ) : (
                      <>
                        <section>
                          <Label
                            htmlFor={loanAccountFieldId}
                            className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                          >
                            Loan account
                          </Label>
                          <div className="relative">
                            <select
                              id={loanAccountFieldId}
                              value={loanAccountId}
                              onChange={(e) => {
                                const v = e.target.value
                                setLoanAccountId(v)
                                setLoanFieldOverride(null)
                              }}
                              disabled={
                                lockTransferPayment && transferPaymentPreset?.kind === "loan_emi"
                              }
                              className={cn(
                                selectFieldClass,
                                !loanAccountId && "text-muted-foreground",
                                lockTransferPayment &&
                                  transferPaymentPreset?.kind === "loan_emi" &&
                                  "cursor-not-allowed opacity-80"
                              )}
                            >
                              <option value="">
                                {loanSelectOptions.length === 0
                                  ? "No loans — add in Accounts"
                                  : "Select loan"}
                              </option>
                              {loanSelectOptions.map((a) => {
                                const emiOpt = resolveLoanEmiAmount(a)
                                const optLabel =
                                  emiOpt != null
                                    ? `${a.name} — EMI ${formatLoanRupee(emiOpt)}/mo`
                                    : accountSelectLabel(a)
                                return (
                                  <option key={a.id} value={a.id}>
                                    {optLabel}
                                  </option>
                                )
                              })}
                            </select>
                            <SelectChevron />
                          </div>
                        </section>

                        {loanScheduleSummary && loanBreakdownVisible ? (
                          <div className="space-y-1 rounded-xl border border-border/80 bg-muted/40 px-3 py-2.5 text-[11px] sm:text-xs">
                            {loanScheduleSummary.emi != null && loanScheduleSummary.emi > 0 ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Monthly EMI</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                  {formatLoanRupee(loanScheduleSummary.emi)}
                                </span>
                              </div>
                            ) : null}
                            {loanScheduleSummary.rate != null &&
                            Number.isFinite(loanScheduleSummary.rate) ? (
                              <div
                                className={cn(
                                  "flex items-center justify-between gap-2",
                                  loanScheduleSummary.emi != null && loanScheduleSummary.emi > 0
                                    ? "border-t border-border/50 pt-1"
                                    : ""
                                )}
                              >
                                <span className="text-muted-foreground">Interest rate (p.a.)</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                  {loanScheduleSummary.rate % 1 === 0
                                    ? `${Math.round(loanScheduleSummary.rate)}%`
                                    : `${loanScheduleSummary.rate.toFixed(2)}%`}
                                </span>
                              </div>
                            ) : null}
                            {(loanScheduleSummary.principalThisMonth != null &&
                              loanScheduleSummary.principalThisMonth > 0) ||
                            (loanScheduleSummary.interestThisMonth != null &&
                              loanScheduleSummary.interestThisMonth > 0) ? (
                              <div className="border-t border-border/50 pt-1">
                                <p className="mb-1 text-[10px] font-semibold text-primary sm:text-[11px]">
                                  This month&apos;s installment split
                                </p>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">Principal</span>
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {loanScheduleSummary.principalThisMonth != null &&
                                    loanScheduleSummary.principalThisMonth > 0
                                      ? formatLoanRupee(loanScheduleSummary.principalThisMonth)
                                      : "—"}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">Interest</span>
                                  <span className="font-semibold tabular-nums text-foreground">
                                    {loanScheduleSummary.interestThisMonth != null &&
                                    loanScheduleSummary.interestThisMonth > 0
                                      ? formatLoanRupee(loanScheduleSummary.interestThisMonth)
                                      : "—"}
                                  </span>
                                </div>
                              </div>
                            ) : null}
                            {loanScheduleSummary.installmentTotal != null &&
                            loanScheduleSummary.installmentTotal > 0 &&
                            (loanScheduleSummary.emi == null || loanScheduleSummary.emi <= 0) ? (
                              <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1">
                                <span className="text-muted-foreground">Installment total</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                  {formatLoanRupee(loanScheduleSummary.installmentTotal)}
                                </span>
                              </div>
                            ) : null}
                            {loanScheduleSummary.totalLoanPrincipal > 0 ? (
                              <div
                                className={cn(
                                  "flex items-center justify-between gap-2",
                                  "border-t border-border/50 pt-1"
                                )}
                              >
                                <span className="text-muted-foreground">Total loan amount</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                  {formatCurrency(loanScheduleSummary.totalLoanPrincipal)}
                                </span>
                              </div>
                            ) : null}
                            {loanScheduleSummary.outstanding > 0 ? (
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground">Outstanding balance</span>
                                <span className="font-semibold tabular-nums text-foreground">
                                  {formatCurrency(loanScheduleSummary.outstanding)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                          <section>
                            <Label
                              htmlFor={loanPrincipalFieldId}
                              className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                            >
                              Principal (payment)
                            </Label>
                            <Input
                              id={loanPrincipalFieldId}
                              inputMode="decimal"
                              placeholder="0.00"
                              value={loanPrincipalStr}
                              onChange={(e) =>
                                setLoanFieldOverride((o) => ({
                                  ...(o ?? {}),
                                  principal: sanitizeDecimalInput(e.target.value),
                                }))
                              }
                              className="h-8 rounded-xl border-border bg-card px-2.5 text-xs tabular-nums shadow-sm sm:h-9 sm:px-3 sm:text-sm"
                            />
                          </section>
                          <section>
                            <Label
                              htmlFor={loanInterestFieldId}
                              className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                            >
                              Interest (payment)
                            </Label>
                            <Input
                              id={loanInterestFieldId}
                              inputMode="decimal"
                              placeholder="0.00"
                              value={loanInterestStr}
                              onChange={(e) =>
                                setLoanFieldOverride((o) => ({
                                  ...(o ?? {}),
                                  interest: sanitizeDecimalInput(e.target.value),
                                }))
                              }
                              className="h-8 rounded-xl border-border bg-card px-2.5 text-xs tabular-nums shadow-sm sm:h-9 sm:px-3 sm:text-sm"
                            />
                          </section>
                        </div>
                      </>
                    )}

                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-2">
                      <section>
                        <Label
                          htmlFor="at-amount-transfer"
                          className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                        >
                          Amount (₹)
                        </Label>
                        {transferDestinationType === "loan_emi" ? (
                          <Input
                            id="at-amount-transfer"
                            readOnly
                            value={formatInr2(loanTotalInr)}
                            className="h-8 rounded-xl border-border bg-muted/60 px-2.5 text-center text-xs font-semibold tabular-nums text-muted-foreground shadow-sm sm:h-9 sm:text-sm"
                          />
                        ) : transferDestinationType === "credit_card_bill" && payMinimum ? (
                          <Input
                            id="at-amount-transfer"
                            readOnly
                            value={
                              minimumDueInr != null && minimumDueInr > 0
                                ? formatInr2(minimumDueInr)
                                : ""
                            }
                            placeholder="—"
                            className="h-8 rounded-xl border-border bg-muted/60 px-2.5 text-center text-xs font-semibold tabular-nums text-muted-foreground placeholder:text-muted-foreground/60 sm:h-9 sm:text-sm"
                          />
                        ) : (
                          <Input
                            id="at-amount-transfer"
                            inputMode="numeric"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                            className="h-8 rounded-xl border-border bg-muted/60 px-2.5 text-center text-xs font-semibold tabular-nums text-primary/80 placeholder:text-primary/40 sm:h-9 sm:text-sm"
                          />
                        )}
                      </section>
                      <section>
                        <Label
                          htmlFor="at-date-transfer"
                          className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                        >
                          Date
                        </Label>
                        <div className="relative">
                          <Input
                            id="at-date-transfer"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="h-8 rounded-xl border-border bg-card px-2.5 pr-8 text-xs shadow-sm scheme-light dark:scheme-dark sm:h-9 sm:px-3 sm:pr-9 sm:text-sm"
                          />
                          <CalendarDays
                            className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                        </div>
                      </section>
                      <section>
                        <Label
                          htmlFor="at-transfer-note-grid"
                          className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                        >
                          Note
                        </Label>
                        <Input
                          id="at-transfer-note-grid"
                          placeholder="Optional note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className="h-8 rounded-xl border-border bg-card px-2.5 text-xs shadow-sm sm:h-9 sm:px-3 sm:text-sm"
                        />
                      </section>
                    </div>
                  </>
                ) : (
                  <>
                    <section>
                      <Label
                        htmlFor="at-amount"
                        className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                      >
                        Amount (₹)
                      </Label>
                      <Input
                        id="at-amount"
                        inputMode="numeric"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                        className="h-10 rounded-xl border-border bg-muted/60 text-center text-xl font-semibold tabular-nums text-primary/80 placeholder:text-primary/40 sm:text-2xl"
                      />
                    </section>

                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <section>
                        {effectiveType === "income" ? (
                          <>
                            <Label
                              htmlFor={incomeSourceId}
                              className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                            >
                              Income source
                            </Label>
                            <div className="relative">
                              <select
                                id={incomeSourceId}
                                value={incomeSource}
                                onChange={(e) => setIncomeSource(e.target.value)}
                                className={selectFieldClass}
                              >
                                {INCOME_SOURCE_OPTIONS.map(({ value, label }) => (
                                  <option key={value} value={value}>
                                    {label}
                                  </option>
                                ))}
                              </select>
                              <SelectChevron />
                            </div>
                          </>
                        ) : (
                          <>
                            <Label
                              htmlFor={categoryId}
                              className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                            >
                              Category
                            </Label>
                            <div className="relative">
                              <select
                                id={categoryId}
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className={cn(
                                  selectFieldClass,
                                  !category && "text-muted-foreground"
                                )}
                              >
                                <option value="">Select category</option>
                                {TX_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                              <SelectChevron />
                            </div>
                          </>
                        )}
                      </section>
                      <section>
                        <Label
                          htmlFor="at-date"
                          className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                        >
                          Date
                        </Label>
                        <div className="relative">
                          <Input
                            id="at-date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="h-8 rounded-xl border-border bg-card px-2.5 pr-8 text-xs shadow-sm scheme-light dark:scheme-dark sm:h-9 sm:px-3 sm:pr-9 sm:text-sm"
                          />
                          <CalendarDays
                            className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden
                          />
                        </div>
                      </section>
                    </div>

                    <section>
                      <Label className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs">
                        Payment Method
                      </Label>
                      <div className="grid grid-cols-2 gap-1">
                        <ToggleTile
                          selected={paymentMethod === "account"}
                          onClick={() => setPaymentMethod("account")}
                        >
                          <CreditCard
                            className="size-3.5 shrink-0 text-primary sm:size-4"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span>Account / Cash / UPI</span>
                        </ToggleTile>
                        <ToggleTile
                          selected={paymentMethod === "card"}
                          onClick={() => setPaymentMethod("card")}
                        >
                          <Gem
                            className="size-3.5 shrink-0 text-primary sm:size-4"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span>Credit Card</span>
                        </ToggleTile>
                      </div>
                    </section>

                    <section>
                      <Label
                        htmlFor={accountIdField}
                        className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                      >
                        {fromAccountLabel}
                      </Label>
                      <div className="relative">
                        <select
                          id={accountIdField}
                          value={accountId}
                          onChange={(e) => setAccountId(e.target.value)}
                          className={cn(selectFieldClass, !accountId && "text-muted-foreground")}
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
                  </>
                )}

                {effectiveType !== "transfer" ? (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-1.5 rounded-lg border border-transparent py-0.5">
                      <input
                        type="checkbox"
                        checked={paidOnBehalf}
                        onChange={(e) => setPaidOnBehalf(e.target.checked)}
                        className="mt-0.5 size-3.5 shrink-0 rounded border-border"
                      />
                      <span className="text-[10px] leading-tight text-foreground sm:text-[11px]">
                        Paid on behalf of someone (add to their dues)
                      </span>
                    </label>
                    <div className="rounded-xl border border-border/80 bg-muted/30 p-1.5">
                      <label className="flex cursor-pointer items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-foreground">
                            Schedule upcoming
                          </span>
                          <p className="text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                            Planned only; no balance change yet.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={scheduleUpcoming}
                          onChange={(e) => setScheduleUpcoming(e.target.checked)}
                          className="mt-0.5 size-3.5 shrink-0 rounded border-border"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {expenseFlow ? (
                  <section>
                    <Label
                      htmlFor="at-note"
                      className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                    >
                      Note
                    </Label>
                    <textarea
                      id="at-note"
                      rows={1}
                      placeholder="What was this for?"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={cn(
                        "min-h-9 w-full resize-none rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm outline-none",
                        "placeholder:text-muted-foreground/80",
                        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                      )}
                    />
                  </section>
                ) : effectiveType === "transfer" ? null : (
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    <section>
                      <Label
                        htmlFor="at-desc"
                        className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                      >
                        Description
                      </Label>
                      <Input
                        id="at-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short description"
                        className="h-8 rounded-xl border-border bg-card px-2.5 text-xs shadow-sm sm:h-9 sm:px-3 sm:text-sm"
                      />
                    </section>
                    <section>
                      <Label
                        htmlFor="at-note"
                        className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                      >
                        Note
                      </Label>
                      <textarea
                        id="at-note"
                        rows={1}
                        placeholder="Optional details…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className={cn(
                          "min-h-8 w-full resize-none rounded-xl border border-border bg-card px-2.5 py-1 text-xs text-foreground shadow-sm outline-none sm:min-h-9 sm:px-3 sm:py-1.5 sm:text-sm",
                          "placeholder:text-muted-foreground/80",
                          "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        )}
                      />
                    </section>
                  </div>
                )}

                <section>
                  <Label className="mb-0.5 flex items-center gap-1 text-[11px] font-bold text-primary sm:text-xs">
                    <Tag className="size-3 sm:size-3.5" strokeWidth={2} aria-hidden />
                    Tags
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    <div className="relative min-w-0 flex-1 basis-[38%]">
                      <select
                        value={tagPreset}
                        onChange={(e) => setTagPreset(e.target.value)}
                        className={cn(selectFieldClass, !tagPreset && "text-muted-foreground")}
                        aria-label="Select tag"
                      >
                        <option value="">
                          {effectiveType === "transfer" ? "Select tag" : "Add tag…"}
                        </option>
                        {TX_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    </div>
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      placeholder={effectiveType === "transfer" ? "Add new tag" : "New tag"}
                      className="h-8 min-w-20 flex-1 rounded-xl border-border bg-card px-2 text-xs shadow-sm sm:h-9"
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
                      size="sm"
                      className="h-8 shrink-0 rounded-xl px-2.5 text-[10px] font-semibold sm:h-9 sm:px-3 sm:text-xs"
                      aria-label="Add tag"
                      onClick={addTagFromInputs}
                    >
                      Add Tag
                    </Button>
                  </div>
                  {tags.length > 0 && (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
                      {tags.join(" · ")}
                    </p>
                  )}
                </section>
              </div>

              <div className={FORM_OVERLAY_FOOTER}>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60 sm:h-11 sm:text-base"
                >
                  {isSubmitting ? "Saving…" : submitLabel}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export function AddTransactionModal({
  open,
  onOpenChange,
  expenseFlow = false,
  initialType = "expense",
  onOpenAddAccount,
  transferPaymentPreset = null,
}: AddTransactionModalProps) {
  if (!open) return null
  const typeKey = expenseFlow ? "expense" : initialType
  const presetKey = transferPaymentPreset
    ? `${transferPaymentPreset.kind}-${
        transferPaymentPreset.kind === "credit_card_bill"
          ? transferPaymentPreset.creditCardAccountId
          : transferPaymentPreset.loanAccountId
      }`
    : "none"
  return (
    <AddTransactionModalMounted
      key={`${typeKey}-${presetKey}`}
      expenseFlow={expenseFlow}
      initialType={expenseFlow ? "expense" : initialType}
      onOpenChange={onOpenChange}
      onOpenAddAccount={onOpenAddAccount}
      transferPaymentPreset={transferPaymentPreset}
    />
  )
}
