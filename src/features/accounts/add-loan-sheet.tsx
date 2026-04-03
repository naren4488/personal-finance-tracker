import { useCallback, useEffect, useId, useState } from "react"
import { CalendarDays, ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { ToggleTile } from "@/components/toggle-tile"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BILLING_DAY_OPTIONS } from "@/lib/billing-day-options"
import { cn } from "@/lib/utils"

const LOAN_TYPES = [
  "Personal Loan",
  "Home Loan",
  "Vehicle Loan",
  "Education Loan",
  "Business Loan",
  "Gold Loan",
  "Other",
] as const

type DueCycle = "fixed" | "rolling"

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

export type AddLoanSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MountedProps = {
  onOpenChange: (open: boolean) => void
}

function AddLoanSheetMounted({ onOpenChange }: MountedProps) {
  const titleId = useId()
  const loanTypeId = useId()
  const overdueAmountId = useId()

  const [loanType, setLoanType] = useState<string>(LOAN_TYPES[0])
  const [loanName, setLoanName] = useState("")
  const [bankLender, setBankLender] = useState("")
  const [loanAccountNo, setLoanAccountNo] = useState("")
  const [principal, setPrincipal] = useState("")
  const [interestRate, setInterestRate] = useState("8.5")
  const [tenureMonths, setTenureMonths] = useState("60")
  const [startDate, setStartDate] = useState(todayIsoDate)
  const [emiDueDay, setEmiDueDay] = useState("5")
  const [dueCycle, setDueCycle] = useState<DueCycle>("fixed")
  const [overrideEmi, setOverrideEmi] = useState(false)
  const [overdue, setOverdue] = useState(false)
  const [overdueAmount, setOverdueAmount] = useState("")

  const dismiss = useCallback(() => {
    document.body.style.overflow = ""
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
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const p = principal.replace(/\D/g, "")
    if (!p || Number(p) <= 0) {
      toast.error("Enter a valid principal amount")
      return
    }

    console.log("[Loan] Add Loan (demo — no loans API yet)", {
      loanType,
      loanName: loanName.trim() || undefined,
      bankLender: bankLender.trim() || undefined,
      loanAccountNo: loanAccountNo.trim() || undefined,
      principalInr: Number(p),
      interestRatePercent: Number(interestRate.replace(/,/g, "")) || 0,
      tenureMonths: Number(tenureMonths.replace(/\D/g, "")) || 0,
      startDate,
      emiDueDay: Number(emiDueDay),
      dueDateCycle: dueCycle,
      overrideEmiAmount: overrideEmi,
      overdue,
      overdueAmountInr: overdue ? Number(overdueAmount.replace(/\D/g, "")) || 0 : undefined,
    })

    toast.success("Loan saved (demo)")
    dismiss()
  }

  const fieldBase =
    "h-9 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"

  return (
    <div className="fixed inset-0 z-50 flex max-h-dvh items-start justify-center overflow-hidden pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:py-4">
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
          "relative flex max-h-[calc(100dvh-0.75rem-env(safe-area-inset-bottom))] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-2.5">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
            Add Loan
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
          <div className="min-h-0 flex-1 space-y-2 overflow-hidden px-4 py-2">
            <section>
              <Label htmlFor={loanTypeId} className="mb-0.5 block text-xs font-bold text-primary">
                Loan Type
              </Label>
              <div className="relative">
                <select
                  id={loanTypeId}
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  className={cn(
                    "h-9 w-full appearance-none rounded-xl border-2 border-primary bg-card px-3 pr-9 text-sm font-medium text-foreground shadow-sm outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring/50"
                  )}
                >
                  {LOAN_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
            </section>

            <section>
              <Label htmlFor="loan-name" className="mb-0.5 block text-xs font-bold text-primary">
                Loan Name
              </Label>
              <Input
                id="loan-name"
                value={loanName}
                onChange={(e) => setLoanName(e.target.value)}
                placeholder="e.g. Home Loan - SBI"
                className={cn(fieldBase)}
              />
            </section>

            <div className="grid grid-cols-2 gap-2">
              <section>
                <Label htmlFor="loan-bank" className="mb-0.5 block text-xs font-bold text-primary">
                  Bank / Lender
                </Label>
                <Input
                  id="loan-bank"
                  value={bankLender}
                  onChange={(e) => setBankLender(e.target.value)}
                  placeholder="e.g. SBI"
                  className={cn(fieldBase)}
                />
              </section>
              <section>
                <Label htmlFor="loan-acct" className="mb-0.5 block text-xs font-bold text-primary">
                  Loan Account No.
                </Label>
                <Input
                  id="loan-acct"
                  value={loanAccountNo}
                  onChange={(e) => setLoanAccountNo(e.target.value)}
                  placeholder="Account number"
                  className={cn(fieldBase)}
                  autoComplete="off"
                />
              </section>
            </div>

            <section>
              <Label
                htmlFor="loan-principal"
                className="mb-0.5 block text-xs font-bold text-primary"
              >
                Principal Amount (₹)
              </Label>
              <Input
                id="loan-principal"
                inputMode="numeric"
                placeholder="0"
                value={principal}
                onChange={(e) => setPrincipal(e.target.value.replace(/[^\d]/g, ""))}
                className="h-12 rounded-xl border border-border bg-muted/60 text-center text-2xl font-semibold tabular-nums text-primary/80 placeholder:text-primary/40"
              />
            </section>

            <div className="grid grid-cols-2 gap-2">
              <section>
                <Label htmlFor="loan-rate" className="mb-0.5 block text-xs font-bold text-primary">
                  Interest Rate (% p.a.)
                </Label>
                <Input
                  id="loan-rate"
                  inputMode="decimal"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value.replace(/[^\d.]/g, ""))}
                  className={cn(fieldBase)}
                />
              </section>
              <section>
                <Label
                  htmlFor="loan-tenure"
                  className="mb-0.5 block text-xs font-bold text-primary"
                >
                  Tenure (months)
                </Label>
                <Input
                  id="loan-tenure"
                  inputMode="numeric"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(e.target.value.replace(/\D/g, ""))}
                  className={cn(fieldBase)}
                />
              </section>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <section>
                <Label htmlFor="loan-start" className="mb-0.5 block text-xs font-bold text-primary">
                  Start Date
                </Label>
                <div className="relative">
                  <Input
                    id="loan-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={cn(fieldBase, "pr-9 scheme-light dark:scheme-dark")}
                  />
                  <CalendarDays
                    className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                </div>
              </section>
              <section>
                <Label
                  htmlFor="loan-emi-day"
                  className="mb-0.5 block text-xs font-bold text-primary"
                >
                  EMI Due Day
                </Label>
                <div className="relative">
                  <select
                    id="loan-emi-day"
                    value={emiDueDay}
                    onChange={(e) => setEmiDueDay(e.target.value)}
                    className={cn(fieldBase, "w-full appearance-none pr-9")}
                  >
                    {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
              </section>
            </div>

            <section>
              <Label className="mb-0.5 block text-xs font-bold text-primary">Due Date Cycle</Label>
              <div className="grid grid-cols-2 gap-1.5">
                <ToggleTile selected={dueCycle === "fixed"} onClick={() => setDueCycle("fixed")}>
                  <span>Fixed Monthly Date</span>
                </ToggleTile>
                <ToggleTile
                  selected={dueCycle === "rolling"}
                  onClick={() => setDueCycle("rolling")}
                >
                  <span>Rolling 30-Day Cycle</span>
                </ToggleTile>
              </div>
              <p
                className={cn(
                  "mt-0.5 text-[10px] leading-tight sm:text-[11px]",
                  dueCycle === "fixed" ? "text-primary/90" : "text-muted-foreground"
                )}
              >
                {dueCycle === "fixed"
                  ? "Due date stays on same calendar day each month"
                  : "Each EMI is due 30 days after the previous due date"}
              </p>
            </section>

            <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">Override EMI amount</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                    Bank EMI may differ due to processing fees, rounding, etc.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={overrideEmi}
                  onClick={() => setOverrideEmi((v) => !v)}
                  className={cn(
                    "relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors",
                    overrideEmi ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200",
                      overrideEmi ? "left-[calc(100%-1.375rem)]" : "left-0.5"
                    )}
                  />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border/80 bg-muted/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">Overdue</p>
                <button
                  type="button"
                  role="switch"
                  aria-checked={overdue}
                  aria-label="Loan is overdue"
                  onClick={() => setOverdue((v) => !v)}
                  className={cn(
                    "relative h-6 w-10 shrink-0 rounded-full transition-colors",
                    overdue ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all duration-200 ease-out",
                      overdue ? "left-[calc(100%-1.375rem)]" : "left-0.5"
                    )}
                  />
                </button>
              </div>
              {overdue ? (
                <div
                  className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200"
                  aria-live="polite"
                >
                  <p className="text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                    Include missed EMIs, penalties, and other overdue charges if applicable.
                  </p>
                  <div>
                    <Label
                      htmlFor={overdueAmountId}
                      className="mb-0.5 block text-xs font-bold text-primary"
                    >
                      Overdue Amount (₹)
                    </Label>
                    <Input
                      id={overdueAmountId}
                      inputMode="numeric"
                      placeholder="0"
                      value={overdueAmount}
                      onChange={(e) => setOverdueAmount(e.target.value.replace(/[^\d]/g, ""))}
                      className={cn(fieldBase)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-border bg-card px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
            <Button
              type="submit"
              className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] sm:h-11 sm:text-base"
            >
              Add Loan
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AddLoanSheet({ open, onOpenChange }: AddLoanSheetProps) {
  if (!open) return null
  return <AddLoanSheetMounted onOpenChange={onOpenChange} />
}
