import { useId } from "react"
import { ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { LoanEmiFormModel } from "@/features/accounts/loan-emi-model"
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
  showOverdue = true,
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

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
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
          Principal Amount (₹)
        </Label>
        <Input
          id="emi-principal"
          inputMode="numeric"
          placeholder="0"
          value={value.principal}
          onChange={(e) => onChange({ principal: e.target.value.replace(/[^\d]/g, "") })}
          className={APP_FORM_FIELD_CLASS}
        />
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
            onCheckedChange={(c) => onChange({ overrideEmi: c })}
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
                Include missed EMIs, penalties, and other overdue charges if applicable.
              </p>
              <div>
                <Label htmlFor={overdueAmountId} className={APP_FORM_LABEL_CLASS}>
                  Overdue Amount (₹)
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
    </div>
  )
}
