import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, CreditCard, Gem, Landmark, Plus, Tag, X } from "lucide-react"
import { type UseFormReturn, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { Badge } from "@/components/ui/badge"
import { ToggleTile } from "@/components/toggle-tile"
import { Button } from "@/components/ui/button"
import { DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import type { Account } from "@/lib/api/account-schemas"
import {
  accountApiTypeOrKind,
  accountSelectLabel,
  filterActiveAccounts,
} from "@/lib/api/account-schemas"
import {
  creditCardAvailableCreditInr,
  creditCardLimitInr,
  creditCardOutstandingInr,
  isCreditCardAccount,
} from "@/lib/api/credit-card-map"
import { getErrorMessage } from "@/lib/api/errors"
import { isLoanAccount } from "@/lib/api/loan-account-map"
import { INCOME_SOURCE_OPTIONS } from "@/lib/api/transaction-schemas"
import { FORM_OVERLAY_FILL_BODY } from "@/lib/form-overlay-scroll"
import {
  TX_FORM_DESCRIPTION_CLASS,
  TX_FORM_FIELDS_STACK_CLASS,
  TX_FORM_FIELD_CLASS,
  TX_FORM_HEADER_CLASS,
  TX_FORM_LABEL_CLASS,
  TX_FORM_SELECT_CLASS,
  TX_FORM_SUBMIT_CLASS,
} from "@/lib/ui/tx-modal-form-classes"
import type {
  CreateTransactionPayload,
  Transaction,
  TransactionType,
  TransferDestinationType,
} from "@/lib/api/schemas"
import { ACCOUNTS_HIGHLIGHT_TX } from "@/features/accounts/accounts-route"
import { formatCurrency } from "@/lib/format"
import { assertSourceAccountCoversAmount } from "@/lib/validation/source-account-balance"
import { cn } from "@/lib/utils"
import {
  useAddTransactionMutation,
  useGetAccountsQuery,
  useGetCreditCardAccountsForPaymentQuery,
  useGetLoanAccountsForEmiQuery,
  useGetPeopleQuery,
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

/** Expense category labels map to POST wire slugs via `mapExpenseCategoryToWireSlug` (transaction-schemas). */
const TX_CATEGORIES = [
  "Food",
  "Drinking",
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
  optionalDescription: string
  onOptionalDescriptionChange: (v: string) => void
}

function CreditCardExpenseFields({
  accounts,
  accountId,
  onAccountIdChange,
  form,
  optionalDescription,
  onOptionalDescriptionChange,
}: CreditCardExpenseFieldsProps) {
  const [tagDraft, setTagDraft] = useState("")
  const selectedCardId = useWatch({ control: form.control, name: "creditCardAccountId" }) ?? ""
  const tags = useWatch({ control: form.control, name: "tags" }) ?? []
  const selectedCard = useMemo(
    () => (selectedCardId ? accounts.find((a) => a.id === selectedCardId) : undefined),
    [accounts, selectedCardId]
  )

  const limit = selectedCard ? creditCardLimitInr(selectedCard) : 0
  const used = selectedCard ? creditCardOutstandingInr(selectedCard) : 0
  const available = selectedCard ? creditCardAvailableCreditInr(selectedCard) : 0
  const limitKnown = limit > 0

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
        <Label htmlFor="at-cc-account" className={TX_FORM_LABEL_CLASS}>
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
            className={cn(TX_FORM_SELECT_CLASS, !accountId && "text-muted-foreground")}
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
          <div className="space-y-2 rounded-xl border border-input bg-muted/20 px-3 py-3 text-sm">
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
      ) : null}

      <section>
        <Label htmlFor="at-cc-amount" className={cn(TX_FORM_LABEL_CLASS, "text-center")}>
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
            TX_FORM_FIELD_CLASS,
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
          <Label htmlFor="at-cc-category" className={TX_FORM_LABEL_CLASS}>
            Category
          </Label>
          <Input
            id="at-cc-category"
            placeholder="e.g. food"
            autoComplete="off"
            {...form.register("category")}
            className={cn(
              TX_FORM_FIELD_CLASS,
              form.formState.errors.category && "border-destructive"
            )}
          />
          {form.formState.errors.category && (
            <p className="mt-1 text-xs text-destructive">
              {form.formState.errors.category.message}
            </p>
          )}
        </section>
        <section>
          <Label htmlFor="at-cc-date" className={TX_FORM_LABEL_CLASS}>
            Date
          </Label>
          <Input
            id="at-cc-date"
            type="date"
            {...form.register("date")}
            className={cn(TX_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
          />
          {form.formState.errors.date && (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.date.message}</p>
          )}
        </section>
      </div>

      <section>
        <Label htmlFor="at-cc-desc-opt" className={TX_FORM_LABEL_CLASS}>
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="at-cc-desc-opt"
          value={optionalDescription}
          onChange={(e) => onOptionalDescriptionChange(e.target.value)}
          placeholder="Short description"
          className={TX_FORM_FIELD_CLASS}
        />
      </section>

      <section>
        <Label htmlFor="at-cc-fee" className={TX_FORM_LABEL_CLASS}>
          Fee amount (₹)
        </Label>
        <Input
          id="at-cc-fee"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0 (optional)"
          {...form.register("feeAmount")}
          className={TX_FORM_FIELD_CLASS}
        />
        <p className="mt-1 text-xs text-muted-foreground">Leave empty for 0</p>
      </section>

      <section>
        <Label htmlFor="at-cc-note" className={TX_FORM_LABEL_CLASS}>
          Note
        </Label>
        <Input
          id="at-cc-note"
          placeholder="Optional"
          autoComplete="off"
          {...form.register("note")}
          className={TX_FORM_FIELD_CLASS}
        />
      </section>

      <section>
        <Label className={cn(TX_FORM_LABEL_CLASS, "flex items-center gap-1.5")}>
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
            className={cn(TX_FORM_FIELD_CLASS, "min-w-32 flex-1")}
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
  expenseOnBehalfPreset?: { personId: string; personName?: string; lock?: boolean } | null
  initialType?: TransactionType
  onOpenAddAccount?: () => void
  transferPaymentPreset?: TransferPaymentPreset | null
  accountsReturnPath?: string
  /** Prefill Pay From / card when opening from account context (`?accountId=`). */
  prefillAccountId?: string | null
  /** After success: `navigate(replace)` (e.g. back to `/accounts?...`). */
  successNavigateTo?: string | null
  /** Called after a successful POST before the modal closes (e.g. skip parent cleanup). */
  onTransactionSuccess?: () => void
}

type MountedProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  expenseFlow: boolean
  expenseOnBehalfPreset: { personId: string; personName?: string; lock?: boolean } | null
  initialType: TransactionType
  onOpenAddAccount?: () => void
  transferPaymentPreset: TransferPaymentPreset | null
  accountsReturnPath?: string
  prefillAccountId: string | null
  successNavigateTo: string | null
  onTransactionSuccess?: () => void
}

function AddTransactionModalMounted({
  open,
  onOpenChange,
  expenseFlow,
  expenseOnBehalfPreset,
  initialType,
  onOpenAddAccount,
  transferPaymentPreset,
  accountsReturnPath,
  prefillAccountId = null,
  successNavigateTo = null,
  onTransactionSuccess,
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

  const presetPersonId = expenseOnBehalfPreset?.personId?.trim() ?? ""
  const presetPersonName = expenseOnBehalfPreset?.personName?.trim() ?? ""
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
  const forceAccountPayment = Boolean(
    expenseOnBehalfPreset?.lock && presetPersonId && (expenseFlow ? true : txType === "expense")
  )
  const effectivePaymentMethod: PaymentMethod = forceAccountPayment ? "account" : paymentMethod
  /** Bank / cash / wallet for "Account / UPI"; credit cards only for "Credit Card". */
  const incomeExpensePayFromOptions = useMemo(
    () => (effectivePaymentMethod === "account" ? transferSourceAccounts : creditCardAccounts),
    [effectivePaymentMethod, transferSourceAccounts, creditCardAccounts]
  )
  const [paidOnBehalf, setPaidOnBehalf] = useState(Boolean(presetPersonId))
  const [behalfPersonId, setBehalfPersonId] = useState(presetPersonId)
  const [expectedReturnDate, setExpectedReturnDate] = useState("")
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
  const showPaidOnBehalf = effectiveType === "expense"
  const isOnBehalfLocked = Boolean(
    showPaidOnBehalf && expenseOnBehalfPreset?.lock && presetPersonId
  )
  const effectiveOnBehalfEnabled = isOnBehalfLocked ? true : paidOnBehalf
  const effectiveOnBehalfPersonId = isOnBehalfLocked ? presetPersonId : behalfPersonId.trim()

  const {
    data: people = [],
    isLoading: peopleLoading,
    isFetching: peopleFetching,
  } = useGetPeopleQuery({}, { skip: !user || !showPaidOnBehalf || !paidOnBehalf })

  const selectedAccount = useMemo(
    () => (accountId ? accounts.find((a) => a.id === accountId) : undefined),
    [accounts, accountId]
  )
  const isCreditCardExpenseMode =
    effectiveType === "expense" &&
    !isOnBehalfLocked &&
    !!selectedAccount &&
    isCreditCardAccountType(selectedAccount)

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

  const peopleListLoading = peopleLoading || peopleFetching

  function dismiss() {
    onOpenChange(false)
  }

  const completeAfterSuccess = useCallback(
    (toastMsg: string, created?: Transaction | null) => {
      toast.success(toastMsg)
      onTransactionSuccess?.()
      const dest = successNavigateTo?.trim()
      if (dest) {
        try {
          const u = new URL(dest, window.location.origin)
          const tid = created?.id != null ? String(created.id).trim() : ""
          if (tid) u.searchParams.set(ACCOUNTS_HIGHLIGHT_TX, tid)
          navigate(`${u.pathname}${u.search}`, { replace: true })
        } catch {
          navigate(dest, { replace: true })
        }
      }
      onOpenChange(false)
    },
    [navigate, onOpenChange, onTransactionSuccess, successNavigateTo]
  )

  const prefillAppliedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      prefillAppliedRef.current = false
      return
    }
    const raw = prefillAccountId?.trim()
    if (!raw) return
    const bank = transferSourceAccounts.some((a) => a.id === raw)
    const card = creditCardAccounts.some((a) => a.id === raw)
    if (!bank && !card) return
    if (prefillAppliedRef.current) return
    prefillAppliedRef.current = true
    queueMicrotask(() => {
      setAccountId(raw)
      setPaymentMethod(card ? "card" : "account")
      if (card && !expenseFlow) setTxType("expense")
    })
  }, [open, prefillAccountId, transferSourceAccounts, creditCardAccounts, expenseFlow])

  useEffect(() => {
    if (!open || expenseFlow) return
    if (effectiveType !== "income" && effectiveType !== "expense") return
    if (isCreditCardExpenseMode) return
    if (!accountId) return
    if (incomeExpensePayFromOptions.some((a) => a.id === accountId)) return
    queueMicrotask(() => setAccountId(""))
  }, [
    open,
    expenseFlow,
    effectiveType,
    isCreditCardExpenseMode,
    paymentMethod,
    incomeExpensePayFromOptions,
    accountId,
  ])

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
    if (effectiveOnBehalfEnabled && !effectiveOnBehalfPersonId) {
      toast.error("Select a person")
      return
    }
    if (effectiveOnBehalfEnabled && effectiveOnBehalfPersonId && !expectedReturnDate.trim()) {
      toast.error("Select expected return date")
      return
    }
    const mergedNote = [description.trim(), values.note.trim()].filter(Boolean).join(" — ")
    const payload: CreateTransactionPayload = {
      type: "expense",
      amount: amt,
      category: values.category.trim(),
      creditCardAccountId: values.creditCardAccountId,
      payFromAccountType: accountApiTypeOrKind(card),
      paymentMethod: "card",
      sourceName: cardLabel,
      feeAmount: String(feeParsed),
      ...(effectiveOnBehalfEnabled && effectiveOnBehalfPersonId
        ? {
            personId: effectiveOnBehalfPersonId,
            dueDate: expectedReturnDate.trim().slice(0, 10),
          }
        : {}),
      paidOnBehalf: effectiveOnBehalfEnabled && Boolean(effectiveOnBehalfPersonId),
      scheduled: false,
      date: values.date,
      note: mergedNote,
      tags: values.tags,
      displayTitle: `Card · ${values.category.trim()}`,
      accountName: cardLabel,
    }

    try {
      const created = await addTransaction(payload).unwrap()
      completeAfterSuccess(expenseFlow ? "Expense added" : "Transaction added", created)
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
      titleBase = note.trim() || description.trim()
      if (!titleBase) {
        toast.error("Add a note or description")
        return
      }
    } else if (effectiveType === "transfer") {
      titleBase = [description.trim(), note.trim()].filter(Boolean).join(" · ") || "Transfer"
    } else {
      titleBase =
        description.trim() ||
        note.trim() ||
        (effectiveType === "expense" ? category.trim() || "Expense" : "Income")
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
    const validSourceAccountIdForSubmit =
      isOnBehalfLocked && !transferSourceAccounts.some((a) => a.id === sourceAccountIdForSubmit)
        ? ""
        : sourceAccountIdForSubmit

    if (!validSourceAccountIdForSubmit) {
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

    const acc = accounts.find((a) => a.id === validSourceAccountIdForSubmit)
    if (effectiveType !== "income" && !assertSourceAccountCoversAmount(acc, submitAmountNum)) {
      return
    }

    const displayTitle = [titleBase, ...tags].filter(Boolean).join(" · ")
    const noteForApi = [description.trim(), note.trim()].filter(Boolean).join(" — ")

    if (effectiveOnBehalfEnabled && !effectiveOnBehalfPersonId) {
      toast.error("Select a person")
      return
    }
    if (effectiveOnBehalfEnabled && effectiveOnBehalfPersonId && !expectedReturnDate.trim()) {
      toast.error("Select expected return date")
      return
    }

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
      paymentMethod: effectivePaymentMethod,
      sourceName: acc?.name ?? "",
      feeAmount: "0",
      ...(effectiveOnBehalfEnabled && effectiveOnBehalfPersonId
        ? {
            personId: effectiveOnBehalfPersonId,
            dueDate: expectedReturnDate.trim().slice(0, 10),
          }
        : {}),
      paidOnBehalf: effectiveOnBehalfEnabled && Boolean(effectiveOnBehalfPersonId),
      scheduled: false,
      date,
      note: noteForApi,
      tags,
      displayTitle,
      accountId: validSourceAccountIdForSubmit,
      accountName: acc?.name,
      payFromAccountType:
        effectiveType === "expense" && acc ? accountApiTypeOrKind(acc) : undefined,
    }

    console.log("[add-transaction] submit — CreateTransactionPayload:", payload)

    try {
      const created = await addTransaction(payload).unwrap()
      completeAfterSuccess(
        expenseFlow
          ? "Expense added"
          : effectiveType === "transfer"
            ? "Transfer added"
            : "Transaction added",
        created
      )
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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle={modalTitle}
      header={
        <header className={TX_FORM_HEADER_CLASS}>
          <div className="flex items-center justify-between gap-2">
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
          </div>
          <DialogDescription className={TX_FORM_DESCRIPTION_CLASS}>
            Log income, expenses, or transfers in one place.
          </DialogDescription>
        </header>
      }
      formProps={
        !isLoading && !isError && hasAccount
          ? { id: "add-transaction-form", onSubmit: handleSubmit }
          : undefined
      }
      footer={
        !isLoading && !isError && hasAccount ? (
          <Button
            form="add-transaction-form"
            type="submit"
            disabled={
              isSubmitting ||
              (effectiveType === "transfer" &&
                transferDestinationType === "credit_card_bill" &&
                isCreditCardPaymentDisabled)
            }
            className={TX_FORM_SUBMIT_CLASS}
          >
            {isSubmitting ? "Saving…" : submitLabel}
          </Button>
        ) : null
      }
    >
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
        <div className={TX_FORM_FIELDS_STACK_CLASS}>
          {!expenseFlow && !lockTransferPayment && (
            <section>
              <Label className={TX_FORM_LABEL_CLASS}>Type</Label>
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
                  <Label htmlFor={accountIdField} className={TX_FORM_LABEL_CLASS}>
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
                      className={cn(TX_FORM_SELECT_CLASS, !accountId && "text-muted-foreground")}
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
                  <Label htmlFor={transferDestinationTypeId} className={TX_FORM_LABEL_CLASS}>
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
                        TX_FORM_SELECT_CLASS,
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
                  <Label htmlFor={toAccountIdField} className={TX_FORM_LABEL_CLASS}>
                    To account
                  </Label>
                  <div className="relative">
                    <select
                      id={toAccountIdField}
                      value={toAccountId}
                      onChange={(e) => setToAccountId(e.target.value)}
                      className={cn(TX_FORM_SELECT_CLASS, !toAccountId && "text-muted-foreground")}
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
                    <Label htmlFor={creditCardAccountFieldId} className={TX_FORM_LABEL_CLASS}>
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
                          const selectedCard = creditCardSelectOptions.find((card) => card.id === v)
                          const selectedRecord = selectedCard as Record<string, unknown> | undefined
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
                          lockTransferPayment && transferPaymentPreset?.kind === "credit_card_bill"
                        }
                        className={cn(
                          TX_FORM_SELECT_CLASS,
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
                        <Label htmlFor="at-minimum-due-transfer" className={TX_FORM_LABEL_CLASS}>
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
                          className={cn(TX_FORM_FIELD_CLASS, "font-medium tabular-nums")}
                        />
                      </section>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <section>
                    <Label htmlFor={loanAccountFieldId} className={TX_FORM_LABEL_CLASS}>
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
                          const selectedRecord = selected as Record<string, unknown> | undefined
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
                        disabled={lockTransferPayment && transferPaymentPreset?.kind === "loan_emi"}
                        className={cn(
                          TX_FORM_SELECT_CLASS,
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
                      <Label htmlFor={loanPrincipalFieldId} className={TX_FORM_LABEL_CLASS}>
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
                        className={cn(TX_FORM_FIELD_CLASS, "tabular-nums")}
                      />
                    </section>
                    <section>
                      <Label htmlFor={loanInterestFieldId} className={TX_FORM_LABEL_CLASS}>
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
                        className={cn(TX_FORM_FIELD_CLASS, "tabular-nums")}
                      />
                    </section>
                  </div>
                </>
              )}

              <section>
                <Label htmlFor="at-transfer-description" className={TX_FORM_LABEL_CLASS}>
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="at-transfer-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short label for this transfer"
                  className={TX_FORM_FIELD_CLASS}
                />
              </section>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <section>
                  <Label htmlFor="at-amount-transfer" className={TX_FORM_LABEL_CLASS}>
                    Amount (₹)
                  </Label>
                  {transferDestinationType === "loan_emi" ? (
                    <Input
                      id="at-amount-transfer"
                      readOnly
                      value={formatInr2(loanTotalInr)}
                      className={cn(
                        TX_FORM_FIELD_CLASS,
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
                        TX_FORM_FIELD_CLASS,
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
                        TX_FORM_FIELD_CLASS,
                        "bg-muted/20 text-center font-semibold tabular-nums text-primary/80 placeholder:text-primary/40"
                      )}
                    />
                  )}
                </section>
                <section>
                  <Label htmlFor="at-date-transfer" className={TX_FORM_LABEL_CLASS}>
                    Date
                  </Label>
                  <Input
                    id="at-date-transfer"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={cn(TX_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
                  />
                </section>
                <section>
                  <Label htmlFor="at-transfer-note-grid" className={TX_FORM_LABEL_CLASS}>
                    Note
                  </Label>
                  <Input
                    id="at-transfer-note-grid"
                    placeholder="Optional note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className={TX_FORM_FIELD_CLASS}
                  />
                </section>
              </div>
            </>
          ) : isCreditCardExpenseMode ? (
            <CreditCardExpenseFields
              accounts={creditCardAccounts}
              accountId={accountId}
              onAccountIdChange={(id) => {
                onIncomeExpenseAccountChange(id)
                ccExpenseForm.setValue("creditCardAccountId", id, { shouldValidate: true })
              }}
              form={ccExpenseForm}
              optionalDescription={description}
              onOptionalDescriptionChange={setDescription}
            />
          ) : (
            <>
              <section>
                <Label htmlFor="at-amount" className={cn(TX_FORM_LABEL_CLASS, "text-center")}>
                  Amount (₹)
                </Label>
                <Input
                  id="at-amount"
                  inputMode="numeric"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                  className={cn(
                    TX_FORM_FIELD_CLASS,
                    "h-14 bg-muted/20 text-center text-2xl font-bold tabular-nums text-primary/80 placeholder:text-primary/40"
                  )}
                />
              </section>

              <div className="grid grid-cols-2 gap-4">
                <section>
                  {effectiveType === "income" ? (
                    <>
                      <Label htmlFor={incomeSourceId} className={TX_FORM_LABEL_CLASS}>
                        Income source
                      </Label>
                      <div className="relative">
                        <select
                          id={incomeSourceId}
                          value={incomeSource}
                          onChange={(e) => setIncomeSource(e.target.value)}
                          className={TX_FORM_SELECT_CLASS}
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
                      <Label htmlFor={categoryId} className={TX_FORM_LABEL_CLASS}>
                        Category
                      </Label>
                      <div className="relative">
                        <select
                          id={categoryId}
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          className={cn(TX_FORM_SELECT_CLASS, !category && "text-muted-foreground")}
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
                  <Label htmlFor="at-date" className={TX_FORM_LABEL_CLASS}>
                    Date
                  </Label>
                  <Input
                    id="at-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={cn(TX_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
                  />
                </section>
              </div>

              <section>
                <Label className={TX_FORM_LABEL_CLASS}>Payment Method</Label>
                <div className="grid grid-cols-2 gap-2">
                  <ToggleTile
                    selected={effectivePaymentMethod === "account"}
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
                    selected={effectivePaymentMethod === "card"}
                    onClick={() => {
                      if (isOnBehalfLocked) return
                      setPaymentMethod("card")
                    }}
                    className={cn("h-10", isOnBehalfLocked && "cursor-not-allowed opacity-60")}
                  >
                    <Gem className="size-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
                    <span className="font-medium">Credit Card</span>
                  </ToggleTile>
                </div>
              </section>

              <section>
                <Label htmlFor={accountIdField} className={TX_FORM_LABEL_CLASS}>
                  {fromAccountLabel}
                </Label>
                <div className="relative">
                  <select
                    id={accountIdField}
                    value={accountId}
                    onChange={(e) => onIncomeExpenseAccountChange(e.target.value)}
                    className={cn(TX_FORM_SELECT_CLASS, !accountId && "text-muted-foreground")}
                  >
                    <option value="">Select account</option>
                    {incomeExpensePayFromOptions.map((a) => (
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

          {showPaidOnBehalf ? (
            <div className="grid grid-cols-1 gap-3">
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-input bg-muted/5 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={effectiveOnBehalfEnabled}
                  disabled={isOnBehalfLocked}
                  onChange={(e) => {
                    if (isOnBehalfLocked) return
                    const checked = e.target.checked
                    setPaidOnBehalf(checked)
                    if (!checked) {
                      setBehalfPersonId("")
                      setExpectedReturnDate("")
                    }
                  }}
                  className="mt-0.5 size-4 shrink-0 rounded border-input"
                />
                <span className="text-xs font-medium leading-tight text-foreground/90">
                  Paid on behalf of someone
                </span>
              </label>
            </div>
          ) : null}

          {showPaidOnBehalf && effectiveOnBehalfEnabled ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section>
                <Label htmlFor="at-person-on-behalf" className={TX_FORM_LABEL_CLASS}>
                  Person
                </Label>
                <div className="relative">
                  <select
                    id="at-person-on-behalf"
                    value={behalfPersonId}
                    onChange={(e) => setBehalfPersonId(e.target.value)}
                    disabled={isOnBehalfLocked}
                    className={cn(TX_FORM_SELECT_CLASS, !behalfPersonId && "text-muted-foreground")}
                    aria-required
                  >
                    {isOnBehalfLocked && presetPersonId ? (
                      <option value={presetPersonId}>
                        {presetPersonName || "Selected person"}
                      </option>
                    ) : null}
                    <option value="">
                      {peopleListLoading ? "Loading people..." : "Select person"}
                    </option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </section>
              <section>
                <Label htmlFor="at-expected-return-date" className={TX_FORM_LABEL_CLASS}>
                  Expected return date
                </Label>
                <Input
                  id="at-expected-return-date"
                  type="date"
                  value={expectedReturnDate}
                  onChange={(e) => setExpectedReturnDate(e.target.value)}
                  className={cn(TX_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
                />
              </section>
            </div>
          ) : null}

          {expenseFlow && !isCreditCardExpenseMode ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section>
                <Label htmlFor="at-exp-flow-desc" className={TX_FORM_LABEL_CLASS}>
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="at-exp-flow-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description"
                  className={TX_FORM_FIELD_CLASS}
                />
              </section>
              <section>
                <Label htmlFor="at-note" className={TX_FORM_LABEL_CLASS}>
                  Note
                </Label>
                <textarea
                  id="at-note"
                  rows={2}
                  placeholder="What was this for?"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={cn(TX_FORM_FIELD_CLASS, "min-h-[3.5rem] resize-none py-2")}
                />
              </section>
            </div>
          ) : effectiveType === "transfer" || isCreditCardExpenseMode ? null : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <section>
                <Label htmlFor="at-desc" className={TX_FORM_LABEL_CLASS}>
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="at-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short description"
                  className={TX_FORM_FIELD_CLASS}
                />
              </section>
              <section>
                <Label htmlFor="at-note" className={TX_FORM_LABEL_CLASS}>
                  Note
                </Label>
                <textarea
                  id="at-note"
                  rows={1}
                  placeholder="Optional details…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={cn(TX_FORM_FIELD_CLASS, "min-h-[2.5rem] resize-none py-2")}
                />
              </section>
            </div>
          )}

          {effectiveType === "transfer" || !isCreditCardExpenseMode ? (
            <section>
              <Label className={cn(TX_FORM_LABEL_CLASS, "flex items-center gap-1.5")}>
                <Tag className="size-3.5" strokeWidth={2.5} aria-hidden />
                Tags
              </Label>
              <div className="flex flex-wrap gap-2">
                <div className="relative min-w-0 flex-1 basis-[38%]">
                  <select
                    value={tagPreset}
                    onChange={(e) => setTagPreset(e.target.value)}
                    className={cn(TX_FORM_SELECT_CLASS, !tagPreset && "text-muted-foreground")}
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
                  className={cn(TX_FORM_FIELD_CLASS, "min-w-24 flex-1")}
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
      )}
    </FormDialog>
  )
}

export function AddTransactionModal({
  open,
  onOpenChange,
  expenseFlow = false,
  expenseOnBehalfPreset = null,
  initialType = "expense",
  onOpenAddAccount,
  transferPaymentPreset = null,
  accountsReturnPath,
  prefillAccountId = null,
  successNavigateTo = null,
  onTransactionSuccess,
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
  const prefillKey = prefillAccountId?.trim() || "none"
  const onBehalfKey = expenseOnBehalfPreset?.personId?.trim() || "none"
  return (
    <AddTransactionModalMounted
      key={`${typeKey}-${presetKey}-${prefillKey}-${onBehalfKey}`}
      open={open}
      expenseFlow={expenseFlow}
      expenseOnBehalfPreset={expenseOnBehalfPreset}
      initialType={expenseFlow ? "expense" : initialType}
      onOpenChange={onOpenChange}
      onOpenAddAccount={onOpenAddAccount}
      transferPaymentPreset={transferPaymentPreset}
      accountsReturnPath={accountsReturnPath}
      prefillAccountId={prefillAccountId}
      successNavigateTo={successNavigateTo}
      onTransactionSuccess={onTransactionSuccess}
    />
  )
}
