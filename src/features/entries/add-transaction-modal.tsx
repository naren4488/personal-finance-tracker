import { useEffect, useId, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CalendarDays, ChevronDown, CreditCard, Gem, Landmark, Tag, X } from "lucide-react"
import { toast } from "sonner"
import { ToggleTile } from "@/components/toggle-tile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { accountSelectLabel, filterActiveAccounts } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { INCOME_SOURCE_OPTIONS } from "@/lib/api/transaction-schemas"
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
import type { TransactionType } from "@/lib/api/schemas"
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
        className="mt-6 h-11 w-full max-w-[14rem] rounded-xl bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
        onClick={onAddAccount}
      >
        Add Account
      </Button>
    </div>
  )
}

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
}

type MountedProps = {
  onOpenChange: (open: boolean) => void
  expenseFlow: boolean
  initialType: TransactionType
  onOpenAddAccount?: () => void
}

function AddTransactionModalMounted({
  onOpenChange,
  expenseFlow,
  initialType,
  onOpenAddAccount,
}: MountedProps) {
  const titleId = useId()
  const categoryId = useId()
  const incomeSourceId = useId()
  const accountIdField = useId()
  const toAccountIdField = useId()
  const transferDestinationTypeId = useId()
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

  const [addTransaction, { isLoading: isSubmitting }] = useAddTransactionMutation()

  const [txType, setTxType] = useState<TransactionType>(() =>
    expenseFlow ? "expense" : initialType
  )
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState(todayIsoDate)
  const [category, setCategory] = useState("")
  const [incomeSource, setIncomeSource] = useState<string>("salary")
  const [accountId, setAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("account")
  const [paidOnBehalf, setPaidOnBehalf] = useState(false)
  const [scheduleUpcoming, setScheduleUpcoming] = useState(false)
  const [note, setNote] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagPreset, setTagPreset] = useState("")
  const [newTag, setNewTag] = useState("")
  /** Transfer only — future: person / external; UI matches reference form. */
  const [transferDestinationType, setTransferDestinationType] = useState<"account">("account")

  const effectiveType: TransactionType = expenseFlow ? "expense" : txType
  /** Transfer needs two accounts; income/expense need one. */
  const hasAccount = effectiveType === "transfer" ? accounts.length >= 2 : accounts.length > 0
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

    const n = amount.replace(/\D/g, "")
    if (!n || Number(n) <= 0) {
      toast.error("Enter a valid amount")
      return
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
      if (!toAccountId) {
        toast.error("Select destination account")
        return
      }
      if (toAccountId === accountId) {
        toast.error("Choose a different account to transfer to")
        return
      }
    }

    const acc = accounts.find((a) => a.id === accountId)
    const displayTitle = [titleBase, ...tags].filter(Boolean).join(" · ")
    const noteForApi = expenseFlow
      ? note.trim()
      : effectiveType === "transfer"
        ? note.trim()
        : [description.trim(), note.trim()].filter(Boolean).join(" — ")

    const payload = {
      type: effectiveType,
      amount: Number(n),
      category: effectiveType === "expense" ? category : "",
      incomeSource: effectiveType === "income" ? incomeSource : undefined,
      toAccountId: effectiveType === "transfer" ? toAccountId : undefined,
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
    <div className="fixed inset-0 z-[60] flex min-h-0 max-h-dvh items-center justify-center overflow-hidden p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
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

          {!isLoading &&
            !isError &&
            accounts.length > 0 &&
            !hasAccount &&
            !expenseFlow &&
            effectiveType === "transfer" && (
              <div
                className={cn(
                  FORM_OVERLAY_SCROLL_BODY,
                  "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center"
                )}
              >
                <p className="text-sm font-semibold text-foreground">Two accounts needed</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Add another account to transfer money between them.
                </p>
                <Button
                  type="button"
                  className="mt-2 rounded-xl"
                  onClick={() => {
                    dismiss()
                    if (onOpenAddAccount) onOpenAddAccount()
                    else navigate("/accounts")
                  }}
                >
                  Add account
                </Button>
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
                {!expenseFlow && (
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
                            if (id === "transfer" && accounts.length < 2) {
                              toast.message("Add at least two accounts to use transfer")
                              return
                            }
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
                            onChange={(e) =>
                              setTransferDestinationType(e.target.value as "account")
                            }
                            className={selectFieldClass}
                            aria-label="Destination type"
                          >
                            <option value="account">Account</option>
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
                            {accounts
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
                    ) : null}

                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                      <section>
                        <Label
                          htmlFor="at-amount-transfer"
                          className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                        >
                          Amount (₹)
                        </Label>
                        <Input
                          id="at-amount-transfer"
                          inputMode="numeric"
                          placeholder="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                          className="h-9 rounded-xl border-border bg-muted/60 text-center text-base font-semibold tabular-nums text-primary/80 placeholder:text-primary/40 sm:h-10 sm:text-lg"
                        />
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
                ) : effectiveType === "transfer" ? (
                  <section>
                    <Label
                      htmlFor="at-transfer-note"
                      className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                    >
                      Note (optional)
                    </Label>
                    <textarea
                      id="at-transfer-note"
                      rows={2}
                      placeholder="Optional note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={cn(
                        "min-h-12 w-full resize-none rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-foreground shadow-sm outline-none sm:min-h-14",
                        "placeholder:text-muted-foreground/80",
                        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                      )}
                    />
                  </section>
                ) : (
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
}: AddTransactionModalProps) {
  if (!open) return null
  const typeKey = expenseFlow ? "expense" : initialType
  return (
    <AddTransactionModalMounted
      key={typeKey}
      expenseFlow={expenseFlow}
      initialType={expenseFlow ? "expense" : initialType}
      onOpenChange={onOpenChange}
      onOpenAddAccount={onOpenAddAccount}
    />
  )
}
