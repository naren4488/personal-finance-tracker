import { useId } from "react"
import { CalendarDays, ChevronDown } from "lucide-react"
import { ToggleTile } from "@/components/toggle-tile"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { LoanEmiFormModel } from "@/features/accounts/loan-emi-model"
import { BILLING_DAY_OPTIONS } from "@/lib/billing-day-options"
import { cn } from "@/lib/utils"

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export function LoanEmiFormFields({
  value,
  onChange,
  compact = false,
  showOverdue = true,
  loanSheetDense = false,
}: {
  value: LoanEmiFormModel
  onChange: (patch: Partial<LoanEmiFormModel>) => void
  compact?: boolean
  showOverdue?: boolean
  /** Tighter vertical rhythm for Add Loan sheet (single-screen layout). */
  loanSheetDense?: boolean
}) {
  const overdueAmountId = useId()

  const lb = compact
    ? "mb-0.5 block text-[10px] font-bold text-primary sm:text-xs"
    : "mb-0.5 block text-xs font-bold text-primary"

  const fieldBase = loanSheetDense
    ? "h-7 rounded-xl border border-border bg-card px-2 text-[11px] text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:px-2.5 sm:text-xs"
    : compact
      ? "h-7 rounded-xl border border-border bg-card px-2 text-xs text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:h-8 sm:px-2.5 sm:text-sm"
      : "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"

  const gap = loanSheetDense ? "gap-1" : compact ? "gap-1.5" : "gap-2"
  const blockGap = loanSheetDense ? "space-y-0.5" : compact ? "space-y-1" : "space-y-2"
  const cycleTileClass = loanSheetDense
    ? "min-h-7 px-1 py-1 text-[9px] leading-tight sm:min-h-7 sm:px-1.5 sm:py-1.5 sm:text-[10px]"
    : undefined

  return (
    <div className={cn(blockGap, "animate-in fade-in slide-in-from-top-1 duration-200")}>
      <div className={cn("grid grid-cols-2", gap)}>
        <section>
          <Label htmlFor="emi-bank" className={lb}>
            Bank / Lender
          </Label>
          <Input
            id="emi-bank"
            value={value.bankLender}
            onChange={(e) => onChange({ bankLender: e.target.value })}
            placeholder="e.g. SBI"
            className={cn(fieldBase)}
          />
        </section>
        <section>
          <Label htmlFor="emi-acct" className={lb}>
            Loan Account No.
          </Label>
          <Input
            id="emi-acct"
            value={value.loanAccountNo}
            onChange={(e) => onChange({ loanAccountNo: e.target.value })}
            placeholder="Account number"
            className={cn(fieldBase)}
            autoComplete="off"
          />
        </section>
      </div>

      <section>
        <Label htmlFor="emi-principal" className={lb}>
          Principal Amount (₹)
        </Label>
        <Input
          id="emi-principal"
          inputMode="numeric"
          placeholder="0"
          value={value.principal}
          onChange={(e) => onChange({ principal: e.target.value.replace(/[^\d]/g, "") })}
          className={cn(
            loanSheetDense
              ? "h-8 rounded-xl border border-border bg-muted/60 px-2 text-center text-base font-semibold tabular-nums text-primary/80 placeholder:text-primary/40 sm:h-8 sm:text-lg"
              : compact
                ? "h-9 rounded-xl border border-border bg-muted/60 text-center text-lg font-semibold tabular-nums text-primary/80 placeholder:text-primary/40 sm:h-10 sm:text-xl"
                : "h-12 rounded-xl border border-border bg-muted/60 text-center text-2xl font-semibold tabular-nums text-primary/80 placeholder:text-primary/40"
          )}
        />
      </section>

      <div className={cn("grid grid-cols-2", gap)}>
        <section>
          <Label htmlFor="emi-rate" className={lb}>
            Interest Rate (% p.a.)
          </Label>
          <Input
            id="emi-rate"
            inputMode="decimal"
            value={value.interestRate}
            onChange={(e) => onChange({ interestRate: e.target.value.replace(/[^\d.]/g, "") })}
            className={cn(fieldBase)}
          />
        </section>
        <section>
          <Label htmlFor="emi-tenure" className={lb}>
            Tenure (months)
          </Label>
          <Input
            id="emi-tenure"
            inputMode="numeric"
            value={value.tenureMonths}
            onChange={(e) => onChange({ tenureMonths: e.target.value.replace(/\D/g, "") })}
            className={cn(fieldBase)}
          />
        </section>
      </div>

      <div className={cn("grid grid-cols-2", gap)}>
        <section>
          <Label htmlFor="emi-start" className={lb}>
            Start Date
          </Label>
          <div className="relative">
            <Input
              id="emi-start"
              type="date"
              value={value.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className={cn(fieldBase, "pr-8 scheme-light dark:scheme-dark sm:pr-9")}
            />
            <CalendarDays
              className="pointer-events-none absolute right-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground sm:right-2 sm:size-4"
              aria-hidden
            />
          </div>
        </section>
        <section>
          <Label htmlFor="emi-due-day" className={lb}>
            EMI Due Day
          </Label>
          <div className="relative">
            <select
              id="emi-due-day"
              value={value.emiDueDay}
              onChange={(e) => onChange({ emiDueDay: e.target.value })}
              className={cn(fieldBase, "w-full appearance-none pr-8 sm:pr-9")}
            >
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

      <section>
        <Label className={lb}>Due Date Cycle</Label>
        <div
          className={cn(
            "grid grid-cols-2",
            loanSheetDense ? "gap-0.5" : compact ? "gap-1" : "gap-1.5"
          )}
        >
          <ToggleTile
            selected={value.dueCycle === "fixed"}
            onClick={() => onChange({ dueCycle: "fixed" })}
            className={cycleTileClass}
          >
            <span>Fixed Monthly Date</span>
          </ToggleTile>
          <ToggleTile
            selected={value.dueCycle === "rolling"}
            onClick={() => onChange({ dueCycle: "rolling" })}
            className={cycleTileClass}
          >
            <span>Rolling 30-Day Cycle</span>
          </ToggleTile>
        </div>
        <p
          className={cn(
            "mt-0.5 text-[9px] leading-tight sm:text-[10px]",
            value.dueCycle === "fixed" ? "text-primary/90" : "text-muted-foreground"
          )}
        >
          {value.dueCycle === "fixed"
            ? "Due date stays on same calendar day each month"
            : "Each EMI is due 30 days after the previous due date"}
        </p>
      </section>

      <div
        className={cn(
          "rounded-xl border border-border/80 bg-muted/30",
          loanSheetDense ? "p-1.5" : compact ? "p-1.5" : "p-2"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <Label
              htmlFor="emi-override-switch"
              className={cn(
                compact ? "text-[10px] font-bold sm:text-xs" : "text-xs font-bold",
                "mb-0 block cursor-pointer text-primary"
              )}
            >
              Override EMI amount
            </Label>
            <p className="mt-0.5 text-[9px] leading-snug text-muted-foreground sm:text-[10px]">
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
        {value.overrideEmi ? (
          <div className="mt-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
            <Label htmlFor="emi-override-amt" className={lb}>
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
              className={cn(fieldBase, "mt-0.5 bg-muted/60 font-semibold tabular-nums")}
            />
          </div>
        ) : null}
      </div>

      {showOverdue ? (
        <div
          className={cn(
            "rounded-xl border border-border/80 bg-muted/30",
            loanSheetDense ? "p-1.5" : compact ? "p-1.5" : "p-2"
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <Label
              htmlFor="emi-overdue-switch"
              className={cn(
                compact ? "text-[10px] font-bold sm:text-xs" : "text-xs font-bold",
                "cursor-pointer text-primary"
              )}
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
          {value.overdue ? (
            <div
              className="mt-1.5 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200"
              aria-live="polite"
            >
              <p className="text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                Include missed EMIs, penalties, and other overdue charges if applicable.
              </p>
              <div>
                <Label htmlFor={overdueAmountId} className={lb}>
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
                  className={cn(fieldBase, "mt-0.5")}
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
