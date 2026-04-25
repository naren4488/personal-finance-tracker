import { useEffect, useId, useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { LoanEmiFormModel } from "@/features/accounts/loan-emi-model"
import { formatCurrency } from "@/lib/format"
import {
  computeReducingBalanceMonthlyEmi,
  formatInterestRateForForm,
  solveAnnualRatePercentForMonthlyEmi,
} from "@/lib/loan/loan-emi-math"
import { BILLING_DAY_OPTIONS } from "@/lib/billing-day-options"
import {
  APP_FORM_FIELD_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SELECT_CLASS,
  APP_FORM_TWO_COL_GRID_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export function LoanEmiFormFields({
  value,
  onChange,
  showOverdue = false,
}: {
  value: LoanEmiFormModel
  onChange: (patch: Partial<LoanEmiFormModel>) => void
  /** @deprecated Kept for call-site compatibility; unused. */
  compact?: boolean
  showOverdue?: boolean
  /** @deprecated Kept for call-site compatibility; unused. */
  loanSheetDense?: boolean
}) {
  const overdueAmountId = useId()

  const principalNum = useMemo(
    () => Number(String(value.principal).replace(/\D/g, "")) || 0,
    [value.principal]
  )
  const tenureNum = useMemo(
    () => Number(String(value.tenureMonths).replace(/\D/g, "")) || 0,
    [value.tenureMonths]
  )
  const rateNum = useMemo(
    () => Number(String(value.interestRate).replace(/[^\d.]/g, "")) || 0,
    [value.interestRate]
  )
  const overrideEmiNum = useMemo(
    () => Number(String(value.overrideEmiAmount).replace(/\D/g, "")) || 0,
    [value.overrideEmiAmount]
  )

  const overdueNum = useMemo(
    () => Number(String(value.overdueAmount).replace(/\D/g, "")) || 0,
    [value.overdueAmount]
  )

  /** Matches POST `openingBalance`: principal + overdue when overdue is on. */
  const openingBalanceSentInr = useMemo(() => {
    const extra = value.overdue ? overdueNum : 0
    return principalNum + extra
  }, [principalNum, value.overdue, overdueNum])

  const estimatedEmi = useMemo(() => {
    if (value.overrideEmi) return null
    return computeReducingBalanceMonthlyEmi(principalNum, rateNum, tenureNum)
  }, [value.overrideEmi, principalNum, rateNum, tenureNum])

  useEffect(() => {
    if (!value.overrideEmi) return
    if (principalNum <= 0 || tenureNum < 1 || overrideEmiNum <= 0) return
    const solved = solveAnnualRatePercentForMonthlyEmi(principalNum, tenureNum, overrideEmiNum)
    if (solved == null || !Number.isFinite(solved)) return
    const next = formatInterestRateForForm(solved)
    const curNum = Number(String(value.interestRate).replace(/[^\d.]/g, "")) || 0
    if (Math.abs(curNum - solved) < 0.0001) return
    onChange({ interestRate: next })
  }, [value.overrideEmi, value.interestRate, principalNum, tenureNum, overrideEmiNum, onChange])

  return (
    <div className="max-w-full min-w-0 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
      {/* Bank / Lender & Loan Account No. */}
      <div className={APP_FORM_TWO_COL_GRID_CLASS}>
        <section>
          <Label htmlFor="emi-bank" className={APP_FORM_LABEL_CLASS}>
            Bank / Lender
          </Label>
          <Input
            id="emi-bank"
            value={value.bankLender}
            onChange={(e) => onChange({ bankLender: e.target.value })}
            placeholder="e.g. SBI"
            className={APP_FORM_FIELD_CLASS}
          />
        </section>
        <section>
          <Label htmlFor="emi-acct" className={APP_FORM_LABEL_CLASS}>
            Loan Account No.
          </Label>
          <Input
            id="emi-acct"
            value={value.loanAccountNo}
            onChange={(e) => onChange({ loanAccountNo: e.target.value })}
            placeholder="Account number"
            className={APP_FORM_FIELD_CLASS}
            autoComplete="off"
          />
        </section>
      </div>

      {/* Principal Amount */}
      <section>
        <Label htmlFor="emi-principal" className={APP_FORM_LABEL_CLASS}>
          Principal amount (₹)
        </Label>
        <Input
          id="emi-principal"
          inputMode="numeric"
          placeholder="0"
          value={value.principal}
          onChange={(e) => onChange({ principal: e.target.value.replace(/[^\d]/g, "") })}
          className={APP_FORM_FIELD_CLASS}
        />
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          Sent as <span className="font-mono text-[10px]">principalAmount</span> on the loan
          account. EMI is calculated from this amount, not from overdue.
        </p>
      </section>

      {/* Interest Rate & Tenure */}
      <div className={APP_FORM_TWO_COL_GRID_CLASS}>
        <section>
          <Label htmlFor="emi-rate" className={APP_FORM_LABEL_CLASS}>
            Interest Rate (% p.a.)
          </Label>
          <Input
            id="emi-rate"
            inputMode="decimal"
            placeholder="8.5"
            value={value.interestRate}
            onChange={(e) => onChange({ interestRate: e.target.value.replace(/[^\d.]/g, "") })}
            className={APP_FORM_FIELD_CLASS}
          />
        </section>
        <section>
          <Label htmlFor="emi-tenure" className={APP_FORM_LABEL_CLASS}>
            Tenure (months)
          </Label>
          <Input
            id="emi-tenure"
            inputMode="numeric"
            placeholder="60"
            value={value.tenureMonths}
            onChange={(e) => onChange({ tenureMonths: e.target.value.replace(/\D/g, "") })}
            className={APP_FORM_FIELD_CLASS}
          />
        </section>
      </div>

      {!value.overrideEmi && estimatedEmi != null && estimatedEmi > 0 ? (
        <section
          className="rounded-xl border border-border bg-muted/20 px-3 py-2.5"
          aria-live="polite"
        >
          <p className="text-xs font-medium text-muted-foreground">Estimated monthly EMI</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(estimatedEmi)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">/ month</span>
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Reducing balance from principal, rate, and tenure. Turn on override to use a different
            EMI.
          </p>
        </section>
      ) : null}

      {/* Start Date & EMI Due Day */}
      <div className={APP_FORM_TWO_COL_GRID_CLASS}>
        <section>
          <Label htmlFor="emi-start" className={APP_FORM_LABEL_CLASS}>
            Start Date
          </Label>
          <Input
            id="emi-start"
            type="date"
            value={value.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className={cn(APP_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
          />
        </section>
        <section>
          <Label htmlFor="emi-due-day" className={APP_FORM_LABEL_CLASS}>
            EMI Due Day
          </Label>
          <div className="relative">
            <select
              id="emi-due-day"
              value={value.emiDueDay}
              onChange={(e) => onChange({ emiDueDay: e.target.value })}
              className={cn(APP_FORM_SELECT_CLASS, "focus:border-primary")}
            >
              <option value="" disabled>
                Select day
              </option>
              {BILLING_DAY_OPTIONS.map(({ value: v, label }) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </section>
      </div>

      {/* Due Date Cycle Toggle */}
      <section>
        <Label className={APP_FORM_LABEL_CLASS}>Due Date Cycle</Label>
        <div className="flex w-full overflow-hidden rounded-xl border border-input bg-muted/30">
          <button
            type="button"
            onClick={() => onChange({ dueCycle: "fixed" })}
            className={cn(
              "flex-1 py-2.5 text-[13px] font-medium transition-colors",
              !value.dueCycle || value.dueCycle === "fixed"
                ? "m-[-1px] rounded-xl border border-primary bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Fixed Monthly Date
          </button>
          <button
            type="button"
            onClick={() => onChange({ dueCycle: "rolling" })}
            className={cn(
              "flex-1 py-2.5 text-[13px] font-medium transition-colors",
              value.dueCycle === "rolling"
                ? "m-[-1px] rounded-xl border border-primary bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Rolling 30-Day Cycle
          </button>
        </div>
      </section>

      {/* Override EMI Amount */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Label
              htmlFor="emi-override-switch"
              className="block cursor-pointer text-sm font-semibold text-foreground"
            >
              Override EMI amount
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Bank EMI may differ due to processing fees, rounding, etc.
            </p>
          </div>
          <Switch
            id="emi-override-switch"
            checked={value.overrideEmi}
            onCheckedChange={(c) => {
              if (c) {
                const est =
                  principalNum > 0 && tenureNum >= 1
                    ? computeReducingBalanceMonthlyEmi(principalNum, rateNum, tenureNum)
                    : null
                onChange({
                  overrideEmi: true,
                  overrideEmiAmount:
                    est != null && est > 0 ? String(Math.round(est)) : value.overrideEmiAmount,
                })
              } else {
                onChange({ overrideEmi: false })
              }
            }}
            aria-label="Override EMI amount"
            className="mt-0.5 shrink-0"
          />
        </div>
        {value.overrideEmi && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <Label htmlFor="emi-override-amt" className={APP_FORM_LABEL_CLASS}>
              Custom EMI amount (₹)
            </Label>
            <Input
              id="emi-override-amt"
              inputMode="numeric"
              placeholder="0"
              value={value.overrideEmiAmount}
              onChange={(e) =>
                onChange({ overrideEmiAmount: e.target.value.replace(/[^\d]/g, "") })
              }
              className={APP_FORM_FIELD_CLASS}
            />
          </div>
        )}
      </div>

      {/* Overdue Section */}
      {showOverdue && (
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-4">
            <Label
              htmlFor="emi-overdue-switch"
              className="cursor-pointer text-sm font-semibold text-foreground"
            >
              Overdue
            </Label>
            <Switch
              id="emi-overdue-switch"
              checked={value.overdue}
              onCheckedChange={(c) => onChange({ overdue: c })}
              aria-label="Loan is overdue"
            />
          </div>
          {value.overdue && (
            <div
              className="mt-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200"
              aria-live="polite"
            >
              <p className="text-xs text-muted-foreground">
                Include missed EMIs, penalties, and other overdue charges if applicable. This is
                added only to <span className="font-mono text-[10px]">openingBalance</span> (and{" "}
                <span className="font-mono text-[10px]">balance</span> when sent), not to{" "}
                <span className="font-mono text-[10px]">principalAmount</span>.
              </p>
              <div>
                <Label htmlFor={overdueAmountId} className={APP_FORM_LABEL_CLASS}>
                  Overdue amount (₹)
                </Label>
                <Input
                  id={overdueAmountId}
                  inputMode="numeric"
                  placeholder="0"
                  value={value.overdueAmount}
                  onChange={(e) =>
                    onChange({ overdueAmount: e.target.value.replace(/[^\d]/g, "") })
                  }
                  className={APP_FORM_FIELD_CLASS}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {openingBalanceSentInr > 0 ? (
        <section
          className="rounded-xl border border-border bg-muted/15 px-3 py-2.5"
          aria-live="polite"
        >
          <p className="text-xs font-medium text-muted-foreground">Opening balance (sent to API)</p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
            {formatCurrency(openingBalanceSentInr)}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Equals principal
            {value.overdue && overdueNum > 0
              ? ` (${formatCurrency(principalNum)} + overdue ${formatCurrency(overdueNum)})`
              : ""}
            . Maps to <span className="font-mono text-[10px]">openingBalance</span> /{" "}
            <span className="font-mono text-[10px]">balance</span> on create.
          </p>
        </section>
      ) : null}
    </div>
  )
}
