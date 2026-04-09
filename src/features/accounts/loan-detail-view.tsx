import { useCallback, useEffect, useState } from "react"
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  Pencil,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Account } from "@/lib/api/account-schemas"
import { dayOfMonthOrdinal, interestRatePercentFromAccount } from "@/lib/api/credit-card-map"
import {
  loanAccountDisplayTail,
  loanHeaderSubtitle,
  loanOutstandingInr,
  loanPrincipalInr,
  loanRepaymentProgressPercent,
  loanTotalPaidInr,
  mapAccountToLoanView,
  resolveLoanEmiAmount,
} from "@/lib/api/loan-account-map"
import {
  RecordLoanPaymentSheet,
  type LoanPaymentMode,
} from "@/features/accounts/record-loan-payment-sheet"
import { getErrorMessage } from "@/lib/api/errors"
import { formatCurrency } from "@/lib/format"
import { useUpdateAccountMutation } from "@/store/api/base-api"
import { cn } from "@/lib/utils"

function comingSoon(label: string) {
  toast.message("Coming soon", { description: `${label} will be available soon.` })
}

const statTileClass =
  "rounded-xl border border-border/60 bg-muted/30 px-3 py-3 text-center sm:px-3.5 sm:py-3.5"

const EMI_DUE_DAY_OPTIONS: { value: string; label: string }[] = Array.from(
  { length: 31 },
  (_, i) => {
    const d = i + 1
    return { value: String(d), label: dayOfMonthOrdinal(d) }
  }
)

function asRec(a: Account): Record<string, unknown> {
  return a as unknown as Record<string, unknown>
}

function cloneAccount(a: Account): Account {
  try {
    return JSON.parse(JSON.stringify(a)) as Account
  } catch {
    return { ...a } as Account
  }
}

function parseDigitsInt(s: string): number {
  const n = Number(s.replace(/\D/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function LoanDetailView({
  open,
  onOpenChange,
  account,
  onLoanUpdated,
  openPaymentRequest,
  onOpenPaymentRequestConsumed,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  /** Optimistic local save until PATCH /accounts exists */
  onLoanUpdated?: (account: Account) => void
  /** When set with detail open, opens Record Loan Payment with this mode (e.g. list → Pay EMI). */
  openPaymentRequest?: { mode: LoanPaymentMode } | null
  onOpenPaymentRequestConsumed?: () => void
}) {
  const navigate = useNavigate()
  const [updateAccount, { isLoading: isSavingLoan }] = useUpdateAccountMutation()
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [paymentMode, setPaymentMode] = useState<LoanPaymentMode>("pay_emi")
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Account | null>(null)

  const dismiss = useCallback(() => {
    setIsEditing(false)
    setDraft(null)
    onOpenChange(false)
  }, [onOpenChange])

  const cancelEdit = useCallback(() => {
    setIsEditing(false)
    setDraft(null)
  }, [])

  const openPaymentSheet = useCallback((mode: LoanPaymentMode) => {
    setPaymentMode(mode)
    setPaymentOpen(true)
  }, [])

  const startEdit = useCallback(() => {
    if (!account) return
    const d = cloneAccount(account)
    const rec = asRec(d)
    const emi = resolveLoanEmiAmount(account)
    if (rec.emiAmount == null && rec.monthlyEmi == null && rec.emi == null && emi != null) {
      rec.emiAmount = (Math.round(emi * 100) / 100).toFixed(2)
    }
    if (rec.loanType == null || String(rec.loanType).trim() === "") {
      rec.loanType = "personal"
    }
    setDraft(d)
    setIsEditing(true)
  }, [account])

  const saveEdit = useCallback(async () => {
    if (!draft) return
    const accountId = String(account?.id ?? "").trim()
    if (!accountId) {
      toast.error("Unable to update loan: missing account id")
      return
    }
    const name = draft.name?.trim() ?? ""
    if (!name) {
      toast.error("Enter loan name")
      return
    }
    const rec = asRec(draft)
    const lender = typeof rec.lenderName === "string" ? rec.lenderName.trim() : ""
    if (!lender) {
      toast.error("Enter lender name")
      return
    }
    const tenure = parseDigitsInt(String(rec.tenureMonths ?? ""))
    if (tenure < 1) {
      toast.error("Enter tenure in months")
      return
    }
    rec.tenureMonths = tenure

    const emiDay = parseDigitsInt(String(rec.emiDueDay ?? ""))
    if (emiDay < 1 || emiDay > 31) {
      toast.error("EMI due day must be 1–31")
      return
    }
    rec.emiDueDay = String(emiDay)

    const principalDigits = String(rec.principalAmount ?? "").replace(/\D/g, "")
    if (!principalDigits || Number(principalDigits) <= 0) {
      toast.error("Enter valid principal amount")
      return
    }
    rec.principalAmount = principalDigits

    const rateStr = String(rec.interestRate ?? "").trim()
    const rateNum = Number(rateStr.replace(/,/g, ""))
    if (!rateStr || !Number.isFinite(rateNum) || rateNum < 0) {
      toast.error("Enter interest rate")
      return
    }
    rec.interestRate = rateStr.replace(/,/g, "")

    const emiStr = String(rec.emiAmount ?? "")
      .replace(/[^\d.]/g, "")
      .trim()
    if (emiStr) {
      const emiNum = Number(emiStr)
      if (!Number.isFinite(emiNum) || emiNum <= 0) {
        toast.error("Enter valid EMI amount")
        return
      }
      rec.emiAmount = (Math.round(emiNum * 100) / 100).toFixed(2)
    } else {
      delete rec.emiAmount
      delete rec.monthlyEmi
      delete rec.emi
    }

    rec.bankName = lender
    rec.name = name
    if (typeof rec.loanAccountNumber === "string" && rec.loanAccountNumber.trim()) {
      rec.loanAccountNo = rec.loanAccountNumber.trim()
    }

    const next = { ...draft, ...rec } as Account
    const startDate = String(rec.startDate ?? "").trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      toast.error("Loan start date is missing or invalid")
      return
    }
    const dueDateCycleRaw = String(rec.dueDateCycle ?? "")
      .trim()
      .toLowerCase()
    const dueDateCycle = dueDateCycleRaw === "rolling" ? "rolling" : "fixed_monthly_date"
    const loanType =
      String(rec.loanType ?? "personal")
        .trim()
        .toLowerCase() || "personal"

    const payload: Record<string, unknown> = {
      name,
      loanType,
      lenderName: lender,
      principalAmount: principalDigits,
      interestRate: rec.interestRate,
      tenureMonths: tenure,
      startDate,
      emiDueDay: String(emiDay),
      dueDateCycle,
      overrideEmiAmountOn: Boolean(emiStr),
    }
    const loanAccountNumber = String(rec.loanAccountNumber ?? rec.loanAccountNo ?? "").trim()
    if (loanAccountNumber) {
      payload.loanAccountNumber = loanAccountNumber
    }
    if (emiStr) {
      payload.overrideEmiAmount = rec.emiAmount
    }

    try {
      console.log("[loan] saving to backend", {
        method: "PUT",
        path: `/accounts/${accountId}`,
        accountId,
        payload,
      })
      console.log("[loan] backend body (JSON exactly as sent):", JSON.stringify(payload, null, 2))
      const updated = await updateAccount({ id: accountId, body: payload }).unwrap()
      console.log("[loan] update success", {
        id: accountId,
        account: updated.account ?? null,
        message: updated.message ?? "Loan updated successfully",
      })
      onLoanUpdated?.((updated.account as Account | undefined) ?? next)
      toast.success("Loan updated successfully")
      setIsEditing(false)
      setDraft(null)
    } catch (error) {
      console.error("[loan] update failed", { id: accountId, error })
      const msg = getErrorMessage(error)
      if (/authorization token is required/i.test(msg)) {
        toast.error("Session expired, please login again")
        navigate("/login", { replace: true })
        return
      }
      toast.error(msg || "Failed to update loan")
    }
  }, [account?.id, draft, navigate, onLoanUpdated, updateAccount])

  useEffect(() => {
    if (!open || paymentOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return
      if (isEditing) {
        cancelEdit()
      } else {
        dismiss()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, paymentOpen, isEditing, cancelEdit, dismiss])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open || !account || !openPaymentRequest) return
    /* eslint-disable react-hooks/set-state-in-effect -- open payment sheet from parent request when detail opens */
    setPaymentMode(openPaymentRequest.mode)
    setPaymentOpen(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    onOpenPaymentRequestConsumed?.()
  }, [open, account, openPaymentRequest, onOpenPaymentRequestConsumed])

  if (!open || !account) return null

  const working = isEditing && draft ? draft : account
  const model = mapAccountToLoanView(working)
  const principal = loanPrincipalInr(working)
  const outstanding = loanOutstandingInr(working)
  const emi = resolveLoanEmiAmount(working)
  const totalPaid = loanTotalPaidInr(working)
  const progressPct = loanRepaymentProgressPercent(working)
  const rate = interestRatePercentFromAccount(working)
  const headerSub = loanHeaderSubtitle(working)
  const acctTail = loanAccountDisplayTail(working)
  const lenderLine =
    [model.lenderName, acctTail].filter(Boolean).join(acctTail ? " · " : "") || null

  const showUpcomingBanner = Boolean(model.emiDueDateLabel || emi != null)

  function patchDraft(patch: Record<string, unknown>) {
    setDraft((d) => (d ? ({ ...d, ...patch } as Account) : d))
  }

  const fieldIn = cn(
    "mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-foreground shadow-sm outline-none",
    "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
  )

  const labelSm = "text-[10px] font-medium text-muted-foreground sm:text-xs"

  return (
    <>
      <RecordLoanPaymentSheet
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        account={account}
        mode={paymentMode}
      />
      <div className="fixed inset-0 z-60 flex items-stretch justify-center sm:items-center sm:p-3">
        <button
          type="button"
          className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
          aria-label="Close"
          onClick={dismiss}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="loan-detail-name"
          className={cn(
            "relative z-10 flex min-h-0 w-full max-w-lg flex-1 flex-col overflow-hidden bg-background shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-1.5rem))] sm:rounded-2xl"
          )}
        >
          <div className="shrink-0 border-b border-border/60 px-4 pb-3 pt-3 sm:px-5 sm:pt-4">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              Back
            </button>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 pb-8 pt-1 [-ms-overflow-style:none] [scrollbar-width:thin] sm:px-5 sm:pb-10"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1
                  id="loan-detail-name"
                  className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl"
                >
                  {model.name}
                </h1>
                {headerSub ? (
                  <p className="mt-1 text-sm font-medium text-muted-foreground">{headerSub}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 shrink-0 rounded-full"
                  aria-label={isEditing ? "Editing loan" : "Edit loan"}
                  disabled={isEditing}
                  onClick={startEdit}
                >
                  <Pencil className="size-[18px]" strokeWidth={2} aria-hidden />
                </Button>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                    model.isActive
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {model.statusLabel}
                </span>
              </div>
            </div>

            {isEditing && draft ? (
              <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-base font-bold text-foreground">Edit Loan</h2>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="loan-edit-name" className={labelSm}>
                      Loan Name
                    </Label>
                    <Input
                      id="loan-edit-name"
                      value={draft.name}
                      onChange={(e) => patchDraft({ name: e.target.value })}
                      className={cn(fieldIn, "mt-1 h-10 text-left text-sm font-semibold")}
                      aria-labelledby="loan-detail-name"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className={labelSm}>EMI Amount (₹)</Label>
                      <Input
                        inputMode="decimal"
                        value={String(asRec(draft).emiAmount ?? "")}
                        onChange={(e) => {
                          let v = e.target.value.replace(/[^\d.]/g, "")
                          const d = v.indexOf(".")
                          if (d !== -1) {
                            const intPart = v.slice(0, d).replace(/\./g, "")
                            const frac = v
                              .slice(d + 1)
                              .replace(/\./g, "")
                              .slice(0, 2)
                            v = frac.length > 0 ? `${intPart}.${frac}` : `${intPart}.`
                          }
                          patchDraft({ emiAmount: v })
                        }}
                        className={cn(fieldIn, "mt-1 h-10 text-left text-sm")}
                        placeholder="EMI"
                      />
                    </div>
                    <div>
                      <Label className={labelSm}>Interest Rate (%)</Label>
                      <Input
                        inputMode="decimal"
                        value={String(asRec(draft).interestRate ?? "")}
                        onChange={(e) => {
                          let v = e.target.value.replace(/[^\d.]/g, "")
                          const d = v.indexOf(".")
                          if (d !== -1) {
                            const intPart = v.slice(0, d).replace(/\./g, "")
                            const frac = v
                              .slice(d + 1)
                              .replace(/\./g, "")
                              .slice(0, 2)
                            v = frac.length > 0 ? `${intPart}.${frac}` : `${intPart}.`
                          }
                          patchDraft({ interestRate: v })
                        }}
                        className={cn(fieldIn, "mt-1 h-10 text-left text-sm")}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className={labelSm}>Bank / Lender</Label>
                      <Input
                        value={String(asRec(draft).lenderName ?? draft.bankName ?? "")}
                        onChange={(e) => patchDraft({ lenderName: e.target.value })}
                        className={cn(fieldIn, "mt-1 h-10 text-left text-sm")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="loan-edit-emi-due-day" className={labelSm}>
                        EMI Due Day
                      </Label>
                      <div className="relative mt-1">
                        <select
                          id="loan-edit-emi-due-day"
                          value={(() => {
                            const raw = String(asRec(draft).emiDueDay ?? "").replace(/\D/g, "")
                            const n = parseDigitsInt(raw)
                            return n >= 1 && n <= 31 ? String(n) : ""
                          })()}
                          onChange={(e) => patchDraft({ emiDueDay: e.target.value })}
                          className={cn(
                            fieldIn,
                            "h-10 w-full appearance-none bg-background pl-2 pr-9 text-left text-sm font-semibold"
                          )}
                        >
                          <option value="">Select day</option>
                          {EMI_DUE_DAY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="loan-edit-account-no" className={labelSm}>
                      Loan account no.
                    </Label>
                    <Input
                      id="loan-edit-account-no"
                      value={String(
                        asRec(draft).loanAccountNumber ?? asRec(draft).loanAccountNo ?? ""
                      )}
                      onChange={(e) => patchDraft({ loanAccountNumber: e.target.value })}
                      className={cn(fieldIn, "mt-1 h-10 text-left text-sm")}
                      placeholder="Account number"
                    />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    type="button"
                    className="h-11 min-h-11 min-w-0 flex-[3] rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:text-base"
                    onClick={saveEdit}
                    disabled={isSavingLoan}
                  >
                    <Check className="mr-2 size-4 shrink-0" strokeWidth={2.5} aria-hidden />
                    {isSavingLoan ? "Saving..." : "Save"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 min-h-11 w-[28%] shrink-0 rounded-xl border-border px-3 text-sm font-semibold sm:px-4"
                    onClick={cancelEdit}
                    disabled={isSavingLoan}
                  >
                    <X className="mr-1.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}

            {showUpcomingBanner ? (
              <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl bg-amber-100/90 px-3 py-3 text-amber-950 dark:bg-amber-950/35 dark:text-amber-100 sm:px-4">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <CalendarDays
                    className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div>
                    <p className="text-sm font-bold">Upcoming EMI due</p>
                    {model.emiDueDateLabel ? (
                      <p className="mt-0.5 text-sm font-medium opacity-90">
                        {model.emiDueDateLabel}
                      </p>
                    ) : null}
                  </div>
                </div>
                {emi != null ? (
                  <p className="shrink-0 text-lg font-bold tabular-nums text-amber-900 dark:text-amber-50">
                    {formatCurrency(emi)}
                  </p>
                ) : null}
              </div>
            ) : null}

            {lenderLine ? (
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-foreground">
                <Building2
                  className="size-5 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{lenderLine}</span>
              </div>
            ) : null}

            {progressPct != null ? (
              <div className="mt-4">
                <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">Progress</span>
                  <span className="font-semibold tabular-nums text-foreground">{progressPct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
              {isEditing && draft ? (
                <>
                  <div className={statTileClass}>
                    <p className={labelSm}>Principal (₹)</p>
                    <Input
                      inputMode="numeric"
                      value={String(asRec(draft).principalAmount ?? "").replace(/\D/g, "")}
                      onChange={(e) =>
                        patchDraft({
                          principalAmount: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      className={fieldIn}
                    />
                  </div>
                  <div className={statTileClass}>
                    <p className={labelSm}>EMI (₹)</p>
                    <Input
                      inputMode="decimal"
                      value={String(asRec(draft).emiAmount ?? "")}
                      onChange={(e) => {
                        let v = e.target.value.replace(/[^\d.]/g, "")
                        const d = v.indexOf(".")
                        if (d !== -1) {
                          const intPart = v.slice(0, d).replace(/\./g, "")
                          const frac = v
                            .slice(d + 1)
                            .replace(/\./g, "")
                            .slice(0, 2)
                          v = frac.length > 0 ? `${intPart}.${frac}` : `${intPart}.`
                        }
                        patchDraft({ emiAmount: v })
                      }}
                      className={fieldIn}
                      placeholder="EMI"
                    />
                  </div>
                  {totalPaid != null ? (
                    <div className={statTileClass}>
                      <p className={labelSm}>
                        Total Paid{model.tenure > 0 ? ` (${model.paid} EMIs)` : ""}
                      </p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-income sm:text-base">
                        {formatCurrency(totalPaid)}
                      </p>
                    </div>
                  ) : null}
                  <div className={statTileClass}>
                    <p className={labelSm}>Remaining</p>
                    <p className="mt-1 text-sm font-bold tabular-nums text-destructive sm:text-base">
                      {formatCurrency(outstanding)}
                    </p>
                  </div>
                  <div className={statTileClass}>
                    <p className={labelSm}>Interest rate (% p.a.)</p>
                    <Input
                      inputMode="decimal"
                      value={String(asRec(draft).interestRate ?? "")}
                      onChange={(e) => {
                        let v = e.target.value.replace(/[^\d.]/g, "")
                        const d = v.indexOf(".")
                        if (d !== -1) {
                          const intPart = v.slice(0, d).replace(/\./g, "")
                          const frac = v
                            .slice(d + 1)
                            .replace(/\./g, "")
                            .slice(0, 2)
                          v = frac.length > 0 ? `${intPart}.${frac}` : `${intPart}.`
                        }
                        patchDraft({ interestRate: v })
                      }}
                      className={fieldIn}
                    />
                  </div>
                  <div className={statTileClass}>
                    <p className={labelSm}>Tenure (months)</p>
                    <Input
                      inputMode="numeric"
                      value={String(asRec(draft).tenureMonths ?? "")}
                      onChange={(e) =>
                        patchDraft({
                          tenureMonths: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      className={fieldIn}
                    />
                  </div>
                </>
              ) : (
                <>
                  {principal > 0 ? (
                    <div className={statTileClass}>
                      <p className={labelSm}>Principal</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-foreground sm:text-base">
                        {formatCurrency(principal)}
                      </p>
                    </div>
                  ) : null}
                  {emi != null ? (
                    <div className={statTileClass}>
                      <p className={labelSm}>EMI</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-foreground sm:text-base">
                        {formatCurrency(emi)}
                      </p>
                    </div>
                  ) : null}
                  {totalPaid != null ? (
                    <div className={statTileClass}>
                      <p className={labelSm}>
                        Total Paid{model.tenure > 0 ? ` (${model.paid} EMIs)` : ""}
                      </p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-income sm:text-base">
                        {formatCurrency(totalPaid)}
                      </p>
                    </div>
                  ) : null}
                  <div className={statTileClass}>
                    <p className={labelSm}>Remaining</p>
                    <p className="mt-1 text-sm font-bold tabular-nums text-destructive sm:text-base">
                      {formatCurrency(outstanding)}
                    </p>
                  </div>
                  {rate != null ? (
                    <div className={statTileClass}>
                      <p className={labelSm}>Interest Rate</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-foreground sm:text-base">
                        {rate % 1 === 0 ? String(Math.round(rate)) : rate.toFixed(1)}% p.a.
                      </p>
                    </div>
                  ) : null}
                  {model.tenure > 0 ? (
                    <div className={statTileClass}>
                      <p className={labelSm}>Tenure</p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-foreground sm:text-base">
                        {model.tenure} months
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {!isEditing ? (
              <div className="mt-5 space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <Button
                    type="button"
                    className="h-11 rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                    onClick={() => openPaymentSheet("pay_emi")}
                  >
                    Pay EMI
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-border font-semibold"
                    onClick={() => openPaymentSheet("repay_emi")}
                  >
                    Repay EMI
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl border-border font-semibold"
                  onClick={() => comingSoon("Close loan")}
                >
                  <XCircle className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden />
                  Close Loan
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="h-11 w-full rounded-xl font-semibold"
                  onClick={() => comingSoon("Delete loan")}
                >
                  <Trash2 className="mr-2 size-4 shrink-0" strokeWidth={2} aria-hidden />
                  Delete Loan
                </Button>
              </div>
            ) : null}

            <div className="mt-8">
              <h2 className="text-base font-bold text-foreground">Payment History</h2>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                No payments recorded yet
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
