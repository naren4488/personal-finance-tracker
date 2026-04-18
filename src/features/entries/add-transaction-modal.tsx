import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, CreditCard, Gem, Landmark, Plus, Tag, X } from "lucide-react"
import { type UseFormReturn, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { ToggleTile } from "@/components/toggle-tile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import type { Account } from "@/lib/api/account-schemas"
import { accountSelectLabel, filterActiveAccounts } from "@/lib/api/account-schemas"
import { creditCardLimitInr, isCreditCardAccount } from "@/lib/api/credit-card-map"
import { getErrorMessage } from "@/lib/api/errors"
import { isLoanAccount } from "@/lib/api/loan-account-map"
import { INCOME_SOURCE_OPTIONS } from "@/lib/api/transaction-schemas"
import {
  FORM_OVERLAY_FILL_BODY,
  FORM_OVERLAY_FOOTER,
  FORM_OVERLAY_SCROLL_BODY,
} from "@/lib/form-overlay-scroll"
import type {
  CreateTransactionPayload,
  TransactionType,
  TransferDestinationType,
} from "@/lib/api/schemas"
import { formatCurrency } from "@/lib/format"
import { assertSourceAccountCoversAmount } from "@/lib/validation/source-account-balance"
import { cn } from "@/lib/utils"
import {
  useAddTransactionMutation,
  useGetAccountsQuery,
  useGetCreditCardAccountsForPaymentQuery,
  useGetLoanAccountsForEmiQuery,
  useGetRecentTransactionsForEmiQuery,
} from "@/store/api/base-api"
import {
  selectCreditCardPaymentDisabled,
  selectCreditCardPaymentFormState,
} from "@/store/credit-card-payment-selectors"
import {
  clearCreditCardPaymentUi,
  setIsMinimumPaymentEnabled,
  setMinimumAmount,
  setSelectedCreditCardId,
} from "@/store/credit-card-payment-ui-slice"
import { selectLoanEmiAutoFill } from "@/store/loan-emi-selectors"
import { clearSelectedLoanAccountId, setSelectedLoanAccountId } from "@/store/loan-emi-ui-slice"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  cardExpenseFormSchema,
  parseNonNegativeFee,
  parsePositiveAmount,
  type CardExpenseFormValues,
} from "@/lib/forms/credit-card-expense-schema"

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

function formatInr2(n: number): string {
  if (!Number.isFinite(n)) return "0.00"
  return n.toFixed(2)
}

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

/** Credit card detection: `kind` from API or legacy `type` field. */
function isCreditCardAccountType(a: Account | undefined): boolean {
  if (!a) return false
  if (isCreditCardAccount(a)) return true
  const t = String((a as Record<string, unknown>).type ?? "")
    .toLowerCase()
    .replace(/\s+/g, "_")
  return t === "credit_card" || t === "creditcard"
}

type CreditCardExpenseFieldsProps = {
  accounts: Account[]
  accountId: string
  onAccountIdChange: (id: string) => void
  form: UseFormReturn<CardExpenseFormValues>
}

function CreditCardExpenseFields({
  accounts,
  accountId,
  onAccountIdChange,
  form,
}: CreditCardExpenseFieldsProps) {
  const [tagDraft, setTagDraft] = useState("")
  const labelClass = "mb-1.5 block text-xs font-semibold text-foreground/80"
  const fieldBase =
    "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
  const selectFieldClass = cn(fieldBase, "appearance-none pr-9")

  const selectedCardId = useWatch({ control: form.control, name: "creditCardAccountId" }) ?? ""
  const tags = useWatch({ control: form.control, name: "tags" }) ?? []
  const selectedCard = useMemo(
    () => (selectedCardId ? accounts.find((a) => a.id === selectedCardId) : undefined),
    [accounts, selectedCardId]
  )

  const addTag = () => {
    const next = tagDraft.trim()
    if (!next) return
    const cur = form.getValues("tags")
    if (cur.includes(next)) {
      setTagDraft("")
      return
    }
    form.setValue("tags", [...cur, next], { shouldValidate: true })
    setTagDraft("")
  }

  const removeTag = (t: string) => {
    form.setValue(
      "tags",
      form.getValues("tags").filter((x) => x !== t),
      { shouldValidate: true }
    )
  }

  return (
    <>
      <section>
        <Label htmlFor="at-cc-account" className={labelClass}>
          Credit card
        </Label>
        <div className="relative">
          <select
            id="at-cc-account"
            value={accountId}
            onChange={(e) => {
              const v = e.target.value
              onAccountIdChange(v)
            }}
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
        {form.formState.errors.creditCardAccountId && (
          <p className="mt-1 text-xs text-destructive">
            {form.formState.errors.creditCardAccountId.message}
          </p>
        )}
      </section>

      {selectedCard && isCreditCardAccount(selectedCard) ? (
        <section>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-input bg-muted/20 px-3 py-3 text-sm">
            <span className="text-muted-foreground">Credit limit</span>
            <span className="font-bold tabular-nums text-foreground">
              {formatCurrency(creditCardLimitInr(selectedCard))}
            </span>
          </div>
        </section>
      ) : null}

      <section>
        <Label htmlFor="at-cc-amount" className={cn(labelClass, "text-center")}>
          Amount (₹)
        </Label>
        <Input
          id="at-cc-amount"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          {...form.register("amount")}
          aria-invalid={!!form.formState.errors.amount}
          className={cn(
            fieldBase,
            "h-14 bg-muted/20 text-center text-2xl font-bold tabular-nums text-primary/80 placeholder:text-primary/40"
          )}
        />
        {form.formState.errors.amount && (
          <p className="mt-1 text-center text-xs text-destructive">
            {form.formState.errors.amount.message}
          </p>
        )}
      </section>

      <div className="grid grid-cols-2 gap-4">
        <section>
          <Label htmlFor="at-cc-category" className={labelClass}>
            Category
          </Label>
          <Input
            id="at-cc-category"
            placeholder="e.g. food"
            autoComplete="off"
            {...form.register("category")}
            className={cn(fieldBase, form.formState.errors.category && "border-destructive")}
          />
          {form.formState.errors.category && (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.category.message}
            </p>
          )}
        </section>
        <section>
          <Label htmlFor="at-cc-date" className={labelClass}>
            Date
          </Label>
          <Input
            id="at-cc-date"
            type="date"
            {...form.register("date")}
            className={cn(fieldBase, "scheme-light dark:scheme-dark")}
          />
          {form.formState.errors.date && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.date.message}</p>
          )}
        </section>
      </div>

      <section>
        <Label htmlFor="at-cc-fee" className={labelClass}>
          Fee amount (₹)
        </Label>
        <Input
          id="at-cc-fee"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0 (optional)"
          {...form.register("feeAmount")}
          className={fieldBase}
        />
        <p className="mt-1 text-xs text-muted-foreground">Leave empty for 0</p>
      </section>

      <section>
        <Label htmlFor="at-cc-note" className={labelClass}>
          Note
        </Label>
        <Input
          id="at-cc-note"
          placeholder="Optional"
          autoComplete="off"
          {...form.register("note")}
          className={fieldBase}
        />
      </section>

      <section>
        <Label className={cn(labelClass, "flex items-center gap-1.5")}>
          <Tag className="size-3.5" strokeWidth={2.5} aria-hidden />
          Tags
        </Label>
        <div className="flex flex-wrap gap-2">
          <Input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="Add tag"
            className={cn(fieldBase, "min-w-32 flex-1")}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-10 shrink-0 rounded-xl"
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
    </>
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

export type TransferPaymentPreset =
  | { kind: "credit_card_bill"; creditCardAccountId: string }
  | { kind: "loan_emi"; loanAccountId: string }

export type AddTransactionModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  expenseFlow?: boolean
  initialType?: TransactionType
  onOpenAddAccount?: () => void
  transferPaymentPreset?: TransferPaymentPreset | null
  accountsReturnPath?: string
}

type MountedProps = {
  onOpenChange: (open: boolean) => void
  expenseFlow: boolean
  initialType: TransactionType
  onOpenAddAccount?: () => void
  transferPaymentPreset: TransferPaymentPreset | null
  accountsReturnPath?: string
}

function AddTransactionModalMounted({
  onOpenChange,
  expenseFlow,
  initialType,
  onOpenAddAccount,
  transferPaymentPreset,
  accountsReturnPath,
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
  const dispatch = useAppDispatch()
  const user = useAppSelector((s) => s.auth.user)

  // Shared Styles mapping to your AddCreditCard requirements
  const labelClass = "mb-1.5 block text-xs font-semibold text-foreground/80"
  const fieldBase =
    "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
  const selectFieldClass = cn(fieldBase, "appearance-none pr-9")

  const {
    data: accountsRaw = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetAccountsQuery(undefined, { skip: !user })

  const accounts = useMemo(() => filterActiveAccounts(accountsRaw), [accountsRaw])
  const { data: creditCardAccountsRaw = [] } = useGetCreditCardAccountsForPaymentQuery(undefined, {
    skip: !user,
  })
  const { data: loanAccountsRaw = [] } = useGetLoanAccountsForEmiQuery(undefined, { skip: !user })
  useGetRecentTransactionsForEmiQuery(undefined, { skip: !user })
  const creditCardAccounts = useMemo(
    () => filterActiveAccounts(creditCardAccountsRaw),
    [creditCardAccountsRaw]
  )
  const loanAccounts = useMemo(() => filterActiveAccounts(loanAccountsRaw), [loanAccountsRaw])
  const creditCardPayment = useAppSelector(selectCreditCardPaymentFormState)
  const isCreditCardPaymentDisabled = useAppSelector(selectCreditCardPaymentDisabled)
  const loanEmiAutoFill = useAppSelector(selectLoanEmiAutoFill)

  const transferSourceAccounts = useMemo(
    () => accounts.filter((a) => !isLoanAccount(a) && !isCreditCardAccount(a)),
    [accounts]
  )

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
  const [transferDestinationType, setTransferDestinationType] = useState<TransferDestinationType>(
    () =>
      transferPaymentPreset?.kind === "credit_card_bill"
        ? "credit_card_bill"
        : transferPaymentPreset?.kind === "loan_emi"
          ? "loan_emi"
          : "account"
  )
  const [minimumAmountText, setMinimumAmountText] = useState("")
  const [loanFieldOverride, setLoanFieldOverride] = useState<{
    principal?: string
    interest?: string
  } | null>(null)

  const effectiveType: TransactionType = expenseFlow ? "expense" : txType
  const hasAccount = accounts.length > 0

  const selectedAccount = useMemo(
    () => (accountId ? accounts.find((a) => a.id === accountId) : undefined),
    [accounts, accountId]
  )
  const isCreditCardExpenseMode =
    effectiveType === "expense" && !!selectedAccount && isCreditCardAccountType(selectedAccount)

  const ccExpenseForm = useForm<CardExpenseFormValues>({
    resolver: zodResolver(cardExpenseFormSchema),
    defaultValues: {
      amount: "",
      category: "",
      creditCardAccountId: "",
      feeAmount: "",
      date: todayIsoDate(),
      note: "",
      tags: [],
    },
  })

  const prevCcModeRef = useRef(false)
  useEffect(() => {
    const entered = isCreditCardExpenseMode && !prevCcModeRef.current
    prevCcModeRef.current = isCreditCardExpenseMode
    if (entered) {
      ccExpenseForm.reset({
        amount: amount || "",
        category: category || "",
        creditCardAccountId: accountId,
        feeAmount: "",
        date,
        note,
        tags: [...tags],
      })
    }
  }, [isCreditCardExpenseMode, accountId, amount, category, date, note, tags, ccExpenseForm])

  useEffect(() => {
    if (isCreditCardExpenseMode && accountId) {
      ccExpenseForm.setValue("creditCardAccountId", accountId)
    }
  }, [isCreditCardExpenseMode, accountId, ccExpenseForm])

  const onIncomeExpenseAccountChange = useCallback(
    (id: string) => {
      setAccountId(id)
      if (expenseFlow) return
      const acc = accounts.find((a) => a.id === id)
      if (acc && isCreditCardAccountType(acc) && txType !== "expense") {
        setTxType("expense")
      }
    },
    [accounts, expenseFlow, txType]
  )

  const loanPrincipalStr =
    loanFieldOverride?.principal !== undefined
      ? loanFieldOverride.principal
      : formatInr2(loanEmiAutoFill.emiPrincipal)

  const loanInterestStr =
    loanFieldOverride?.interest !== undefined
      ? loanFieldOverride.interest
      : formatInr2(loanEmiAutoFill.emiInterest)

  const loanTotalInr = useMemo(() => {
    if (loanFieldOverride) {
      const p = Number(loanPrincipalStr.trim()) || 0
      const i = Number(loanInterestStr.trim()) || 0
      return Math.round((p + i) * 100) / 100
    }
    return loanEmiAutoFill.emiTotal
  }, [loanFieldOverride, loanPrincipalStr, loanInterestStr, loanEmiAutoFill.emiTotal])

  function resetTransferDependentState() {
    setToAccountId("")
    if (!lockTransferPayment) {
      setCreditCardAccountId("")
      dispatch(clearCreditCardPaymentUi())
      setLoanAccountId("")
      dispatch(clearSelectedLoanAccountId())
    } else if (transferPaymentPreset?.kind === "credit_card_bill") {
      setLoanAccountId("")
      dispatch(clearSelectedLoanAccountId())
      setCreditCardAccountId(transferPaymentPreset.creditCardAccountId)
      dispatch(setSelectedCreditCardId(transferPaymentPreset.creditCardAccountId))
    } else if (transferPaymentPreset?.kind === "loan_emi") {
      setCreditCardAccountId("")
      dispatch(clearCreditCardPaymentUi())
      setLoanAccountId(transferPaymentPreset.loanAccountId)
      dispatch(setSelectedLoanAccountId(transferPaymentPreset.loanAccountId))
    }
    setAmount("")
    setMinimumAmountText("")
    setLoanFieldOverride(null)
  }

  useEffect(() => {
    if (loanAccountId) {
      dispatch(setSelectedLoanAccountId(loanAccountId))
    } else {
      dispatch(clearSelectedLoanAccountId())
    }
  }, [dispatch, loanAccountId])

  useEffect(() => {
    if (creditCardAccountId) {
      dispatch(setSelectedCreditCardId(creditCardAccountId))
    } else {
      dispatch(clearCreditCardPaymentUi())
    }
  }, [dispatch, creditCardAccountId])

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

  async function submitCreditCardExpense(values: CardExpenseFormValues) {
    const amt = parsePositiveAmount(values.amount)
    if (amt == null) return
    const feeParsed = parseNonNegativeFee(values.feeAmount)
    if (feeParsed === null) {
      toast.error("Fee must be empty or a non-negative number")
      return
    }
    const card = accounts.find((a) => a.id === values.creditCardAccountId)
    if (!card) {
      toast.error("Select a credit card")
      return
    }
    if (!assertSourceAccountCoversAmount(card, amt)) return

    const cardLabel = accountSelectLabel(card)
    const payload: CreateTransactionPayload = {
      type: "expense",
      amount: amt,
      category: values.category.trim(),
      creditCardAccountId: values.creditCardAccountId,
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
      toast.success(expenseFlow ? "Expense added" : "Transaction added")
      dismiss()
    } catch (err) {
      console.error("[transactions] submit error", err)
      toast.error(getErrorMessage(err))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!hasAccount) return

    if (effectiveType === "expense" && isCreditCardExpenseMode) {
      await ccExpenseForm.handleSubmit(submitCreditCardExpense)(e)
      return
    }

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
    const sourceAccountIdForSubmit =
      effectiveType === "transfer" && transferDestinationType === "credit_card_bill"
        ? accountId || creditCardPayment.fromAccountId || ""
        : accountId

    if (!sourceAccountIdForSubmit) {
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
        if (isCreditCardPaymentDisabled) {
          toast.error("Payment is not available for this card")
          return
        }
      } else if (transferDestinationType === "loan_emi") {
        if (!loanAccountId) {
          toast.error("Select loan account")
          return
        }
        if (loanEmiAutoFill.isDisabled) {
          toast.error("EMI is not available for this loan")
          return
        }
      }
    }

    let submitAmountNum: number
    if (effectiveType === "transfer") {
      if (transferDestinationType === "credit_card_bill") {
        submitAmountNum = creditCardPayment.paymentAmount
      } else if (transferDestinationType === "loan_emi") {
        submitAmountNum = loanTotalInr
      } else {
        submitAmountNum = Number(amount.replace(/\D/g, ""))
      }
    } else {
      submitAmountNum = Number(amount.replace(/\D/g, ""))
    }

    const acc = accounts.find((a) => a.id === sourceAccountIdForSubmit)
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
          ? Number(loanPrincipalStr.trim()) || 0
          : undefined,
      interestComponent:
        effectiveType === "transfer" && transferDestinationType === "loan_emi"
          ? Number(loanInterestStr.trim()) || 0
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
      accountId: sourceAccountIdForSubmit,
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
          "relative flex min-h-0 max-h-[min(calc(100dvh-1.25rem-env(safe-area-inset-bottom)),92dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
            {modalTitle}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
            onClick={dismiss}
          >
            <X className="size-4" strokeWidth={2.5} />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading && (
            <div className={cn(FORM_OVERLAY_FILL_BODY, "justify-center px-5 py-5")}>
              <div className="space-y-4">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            </div>
          )}

          {isError && !isLoading && (
            <div
              className={cn(
                FORM_OVERLAY_FILL_BODY,
                "items-center justify-center gap-4 px-5 py-5 text-center"
              )}
            >
              <p className="text-sm font-medium text-destructive">{getErrorMessage(error)}</p>
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl px-6"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !isError && accounts.length === 0 && (
            <div className={cn(FORM_OVERLAY_FILL_BODY, "justify-center px-5 py-5")}>
              <NoAccountsEmptyState
                onAddAccount={() => {
                  dismiss()
                  if (onOpenAddAccount) onOpenAddAccount()
                  else navigate(accountsReturnPath ?? "/accounts")
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
              <div className={cn(FORM_OVERLAY_SCROLL_BODY, "space-y-4 px-5 py-5")}>
                {!expenseFlow && !lockTransferPayment && (
                  <section>
                    <Label className={labelClass}>Type</Label>
                    <div className="grid grid-cols-3 gap-3">
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
                            "h-10",
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
                          <span className="font-medium">{label}</span>
                        </ToggleTile>
                      ))}
                    </div>
                  </section>
                )}

                {effectiveType === "transfer" ? (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <section>
                        <Label htmlFor={accountIdField} className={labelClass}>
                          {fromAccountLabel}
                        </Label>
                        <div className="relative">
                          <select
                            id={accountIdField}
                            value={
                              transferDestinationType === "credit_card_bill"
                                ? accountId || creditCardPayment.fromAccountId || ""
                                : accountId
                            }
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
                        <Label htmlFor={transferDestinationTypeId} className={labelClass}>
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
                        <Label htmlFor={toAccountIdField} className={labelClass}>
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
                          <Label htmlFor={creditCardAccountFieldId} className={labelClass}>
                            Credit card
                          </Label>
                          <div className="relative">
                            <select
                              id={creditCardAccountFieldId}
                              value={creditCardAccountId}
                              onChange={(e) => {
                                const v = e.target.value
                                setCreditCardAccountId(v)
                                setToAccountId(v)
                                const selectedCard = creditCardSelectOptions.find(
                                  (card) => card.id === v
                                )
                                const selectedRecord = selectedCard as
                                  | Record<string, unknown>
                                  | undefined
                                const linkedRepaymentAccountId =
                                  selectedRecord &&
                                  typeof selectedRecord.linkedRepaymentAccountId === "string"
                                    ? selectedRecord.linkedRepaymentAccountId
                                    : ""
                                if (linkedRepaymentAccountId) {
                                  setAccountId(linkedRepaymentAccountId)
                                }
                              }}
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
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2  items-center ">
                          <div className="flex h-10 mt-6 items-center justify-between gap-2  rounded-xl border border-input bg-muted/20 px-3">
                            <span className="text-sm font-semibold text-primary ">
                              Pay Minimum Amount
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                {creditCardPayment.isMinimumPaymentEnabled ? "Yes" : "No"}
                              </span>
                              <Switch
                                checked={creditCardPayment.isMinimumPaymentEnabled}
                                onCheckedChange={(on) => {
                                  dispatch(setIsMinimumPaymentEnabled(on))
                                  if (!on) setMinimumAmountText("")
                                }}
                                aria-label="Pay minimum amount"
                              />
                            </div>
                          </div>
                          {creditCardPayment.isMinimumPaymentEnabled ? (
                            <section>
                              <Label htmlFor="at-minimum-due-transfer" className={labelClass}>
                                Minimum amount
                              </Label>
                              <Input
                                id="at-minimum-due-transfer"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={minimumAmountText}
                                onChange={(e) => {
                                  const next = sanitizeDecimalInput(e.target.value)
                                  setMinimumAmountText(next)
                                  const parsed = Number(next)
                                  if (next.trim() === "" || !Number.isFinite(parsed)) {
                                    dispatch(setMinimumAmount(null))
                                    return
                                  }
                                  dispatch(setMinimumAmount(parsed))
                                }}
                                className={cn(fieldBase, "font-medium tabular-nums")}
                              />
                            </section>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <>
                        <section>
                          <Label htmlFor={loanAccountFieldId} className={labelClass}>
                            Loan account
                          </Label>
                          <div className="relative">
                            <select
                              id={loanAccountFieldId}
                              value={loanAccountId}
                              onChange={(e) => {
                                const v = e.target.value
                                setLoanAccountId(v)
                                setToAccountId(v)
                                const selected = loanSelectOptions.find((loan) => loan.id === v)
                                const selectedRecord = selected as
                                  | Record<string, unknown>
                                  | undefined
                                const linkedRepaymentAccountId =
                                  selectedRecord &&
                                  typeof selectedRecord.linkedRepaymentAccountId === "string"
                                    ? selectedRecord.linkedRepaymentAccountId
                                    : ""
                                if (linkedRepaymentAccountId) {
                                  setAccountId(linkedRepaymentAccountId)
                                }
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
                                return (
                                  <option key={a.id} value={a.id}>
                                    {accountSelectLabel(a)}
                                  </option>
                                )
                              })}
                            </select>
                            <SelectChevron />
                          </div>
                        </section>

                        {loanAccountId ? (
                          <div className="space-y-1.5 rounded-xl border border-input bg-muted/20 p-4 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">EMI total</span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {formatInr2(loanEmiAutoFill.emiTotal)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">EMI interest</span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {formatInr2(loanEmiAutoFill.emiInterest)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">EMI principal</span>
                              <span className="font-semibold tabular-nums text-foreground">
                                {formatInr2(loanEmiAutoFill.emiPrincipal)}
                              </span>
                            </div>
                            {loanEmiAutoFill.lastPaymentDate ? (
                              <div className="border-t border-border/50 pt-2">
                                <span className="text-muted-foreground">
                                  Last payment: {loanEmiAutoFill.lastPaymentDate}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-4">
                          <section>
                            <Label htmlFor={loanPrincipalFieldId} className={labelClass}>
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
                              className={cn(fieldBase, "tabular-nums")}
                            />
                          </section>
                          <section>
                            <Label htmlFor={loanInterestFieldId} className={labelClass}>
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
                              className={cn(fieldBase, "tabular-nums")}
                            />
                          </section>
                        </div>
                      </>
                    )}

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                      <section>
                        <Label htmlFor="at-amount-transfer" className={labelClass}>
                          Amount (₹)
                        </Label>
                        {transferDestinationType === "loan_emi" ? (
                          <Input
                            id="at-amount-transfer"
                            readOnly
                            value={formatInr2(loanTotalInr)}
                            className={cn(
                              fieldBase,
                              "bg-muted/40 text-center font-semibold tabular-nums text-muted-foreground"
                            )}
                          />
                        ) : transferDestinationType === "credit_card_bill" ? (
                          <Input
                            id="at-amount-transfer"
                            readOnly
                            value={formatInr2(creditCardPayment.paymentAmount)}
                            placeholder="0.00"
                            className={cn(
                              fieldBase,
                              "bg-muted/40 text-center font-semibold tabular-nums text-muted-foreground placeholder:text-muted-foreground/60"
                            )}
                          />
                        ) : (
                          <Input
                            id="at-amount-transfer"
                            inputMode="numeric"
                            placeholder="0"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                            className={cn(
                              fieldBase,
                              "bg-muted/20 text-center font-semibold tabular-nums text-primary/80 placeholder:text-primary/40"
                            )}
                          />
                        )}
                      </section>
                      <section>
                        <Label htmlFor="at-date-transfer" className={labelClass}>
                          Date
                        </Label>
                        <Input
                          id="at-date-transfer"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className={cn(fieldBase, "scheme-light dark:scheme-dark")}
                        />
                      </section>
                      <section>
                        <Label htmlFor="at-transfer-note-grid" className={labelClass}>
                          Note
                        </Label>
                        <Input
                          id="at-transfer-note-grid"
                          placeholder="Optional note"
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          className={fieldBase}
                        />
                      </section>
                    </div>
                  </>
                ) : isCreditCardExpenseMode ? (
                  <CreditCardExpenseFields
                    accounts={accounts}
                    accountId={accountId}
                    onAccountIdChange={(id) => {
                      onIncomeExpenseAccountChange(id)
                      ccExpenseForm.setValue("creditCardAccountId", id, { shouldValidate: true })
                    }}
                    form={ccExpenseForm}
                  />
                ) : (
                  <>
                    <section>
                      <Label htmlFor="at-amount" className={cn(labelClass, "text-center")}>
                        Amount (₹)
                      </Label>
                      <Input
                        id="at-amount"
                        inputMode="numeric"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                        className={cn(
                          fieldBase,
                          "h-14 bg-muted/20 text-center text-2xl font-bold tabular-nums text-primary/80 placeholder:text-primary/40"
                        )}
                      />
                    </section>

                    <div className="grid grid-cols-2 gap-4">
                      <section>
                        {effectiveType === "income" ? (
                          <>
                            <Label htmlFor={incomeSourceId} className={labelClass}>
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
                            <Label htmlFor={categoryId} className={labelClass}>
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
                        <Label htmlFor="at-date" className={labelClass}>
                          Date
                        </Label>
                        <Input
                          id="at-date"
                          type="date"
                          value={date}
                          onChange={(e) => setDate(e.target.value)}
                          className={cn(fieldBase, "scheme-light dark:scheme-dark")}
                        />
                      </section>
                    </div>

                    <section>
                      <Label className={labelClass}>Payment Method</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <ToggleTile
                          selected={paymentMethod === "account"}
                          onClick={() => setPaymentMethod("account")}
                          className="h-10"
                        >
                          <CreditCard
                            className="size-4 shrink-0 text-primary"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span className="font-medium">Account / UPI</span>
                        </ToggleTile>
                        <ToggleTile
                          selected={paymentMethod === "card"}
                          onClick={() => setPaymentMethod("card")}
                          className="h-10"
                        >
                          <Gem
                            className="size-4 shrink-0 text-primary"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <span className="font-medium">Credit Card</span>
                        </ToggleTile>
                      </div>
                    </section>

                    <section>
                      <Label htmlFor={accountIdField} className={labelClass}>
                        {fromAccountLabel}
                      </Label>
                      <div className="relative">
                        <select
                          id={accountIdField}
                          value={accountId}
                          onChange={(e) => onIncomeExpenseAccountChange(e.target.value)}
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

                {effectiveType !== "transfer" && !isCreditCardExpenseMode ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-input bg-muted/5 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={paidOnBehalf}
                        onChange={(e) => setPaidOnBehalf(e.target.checked)}
                        className="mt-0.5 size-4 shrink-0 rounded border-input"
                      />
                      <span className="text-xs font-medium leading-tight text-foreground/90">
                        Paid on behalf of someone (add to their dues)
                      </span>
                    </label>
                    <div className="rounded-xl border border-input bg-muted/10 p-2.5">
                      <label className="flex cursor-pointer items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-sm font-semibold text-foreground">
                            Schedule upcoming
                          </span>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Planned only; no balance change yet.
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={scheduleUpcoming}
                          onChange={(e) => setScheduleUpcoming(e.target.checked)}
                          className="mt-0.5 size-4 shrink-0 rounded border-input"
                        />
                      </label>
                    </div>
                  </div>
                ) : null}

                {expenseFlow && !isCreditCardExpenseMode ? (
                  <section>
                    <Label htmlFor="at-note" className={labelClass}>
                      Note
                    </Label>
                    <textarea
                      id="at-note"
                      rows={2}
                      placeholder="What was this for?"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={cn(fieldBase, "min-h-[3.5rem] resize-none py-2")}
                    />
                  </section>
                ) : effectiveType === "transfer" || isCreditCardExpenseMode ? null : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <section>
                      <Label htmlFor="at-desc" className={labelClass}>
                        Description
                      </Label>
                      <Input
                        id="at-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Short description"
                        className={fieldBase}
                      />
                    </section>
                    <section>
                      <Label htmlFor="at-note" className={labelClass}>
                        Note
                      </Label>
                      <textarea
                        id="at-note"
                        rows={1}
                        placeholder="Optional details…"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className={cn(fieldBase, "min-h-[2.5rem] resize-none py-2")}
                      />
                    </section>
                  </div>
                )}

                {effectiveType === "transfer" || !isCreditCardExpenseMode ? (
                  <section>
                    <Label className={cn(labelClass, "flex items-center gap-1.5")}>
                      <Tag className="size-3.5" strokeWidth={2.5} aria-hidden />
                      Tags
                    </Label>
                    <div className="flex flex-wrap gap-2">
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
                        <SelectChevron />
                      </div>
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder={effectiveType === "transfer" ? "Add new tag" : "New tag"}
                        className={cn(fieldBase, "min-w-24 flex-1")}
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
                        className="h-10 shrink-0 rounded-xl px-4 text-xs font-bold sm:px-5 sm:text-sm"
                        aria-label="Add tag"
                        onClick={addTagFromInputs}
                      >
                        Add Tag
                      </Button>
                    </div>
                    {tags.length > 0 && (
                      <p className="mt-2 truncate text-xs font-medium text-muted-foreground">
                        {tags.join(" · ")}
                      </p>
                    )}
                  </section>
                ) : null}
              </div>

              <div className={cn(FORM_OVERLAY_FOOTER, "px-5")}>
                <Button
                  type="submit"
                  disabled={
                    isSubmitting ||
                    (effectiveType === "transfer" &&
                      transferDestinationType === "credit_card_bill" &&
                      isCreditCardPaymentDisabled)
                  }
                  className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60 sm:h-11 sm:text-base"
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
  accountsReturnPath,
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
      accountsReturnPath={accountsReturnPath}
    />
  )
}
