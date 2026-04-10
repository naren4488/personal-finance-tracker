import { useCallback, useEffect, useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loanTypeLabelToApiSlug, type CreateAccountRequest } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { endUserSession } from "@/lib/auth/end-session"
import { LoanEmiFormFields } from "@/features/accounts/loan-emi-form-fields"
import {
  createInitialLoanEmiModel,
  type LoanEmiFormModel,
} from "@/features/accounts/loan-emi-model"
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
import { cn } from "@/lib/utils"
import { useCreateAccountMutation } from "@/store/api/base-api"
import { useAppDispatch } from "@/store/hooks"

const LOAN_TYPES = [
  "Personal Loan",
  "Home Loan",
  "Vehicle Loan",
  "Education Loan",
  "Business Loan",
  "Gold Loan",
  "Other",
] as const

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
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
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const titleId = useId()
  const loanTypeId = useId()

  const [loanType, setLoanType] = useState<string>(LOAN_TYPES[0])
  const [loanName, setLoanName] = useState("")
  const [emi, setEmi] = useState<LoanEmiFormModel>(() => createInitialLoanEmiModel())
  const [createAccount, { isLoading: isSubmitting }] = useCreateAccountMutation()

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

  function patchEmi(p: Partial<LoanEmiFormModel>) {
    setEmi((s) => ({ ...s, ...p }))
  }

  function resetForm() {
    setLoanType(LOAN_TYPES[0])
    setLoanName("")
    setEmi(createInitialLoanEmiModel())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = loanName.trim()
    if (!name) {
      toast.error("Enter a loan name")
      return
    }

    const lender = emi.bankLender.trim()
    if (!lender) {
      toast.error("Enter bank or lender name")
      return
    }

    const p = emi.principal.replace(/\D/g, "")
    if (!p || Number(p) <= 0) {
      toast.error("Enter a valid principal amount")
      return
    }

    const tenure = Number(emi.tenureMonths.replace(/\D/g, "")) || 0
    if (tenure < 1) {
      toast.error("Enter tenure in months")
      return
    }

    if (!emi.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(emi.startDate)) {
      toast.error("Enter a valid start date")
      return
    }

    const emiDay = Number(String(emi.emiDueDay).replace(/\D/g, "")) || 0
    if (emiDay < 1 || emiDay > 31) {
      toast.error("Select EMI due day")
      return
    }

    const principalDigits = Number(p)
    const overdueExtra = emi.overdue ? Number(emi.overdueAmount.replace(/\D/g, "")) || 0 : 0
    const balanceInr = principalDigits + overdueExtra

    const payload: CreateAccountRequest = {
      name,
      kind: "loan",
      balanceInr,
      bankName: lender,
      isActive: true,
      loanType: loanTypeLabelToApiSlug(loanType),
      lenderName: lender,
      loanAccountNumber: emi.loanAccountNo.trim() || undefined,
      principalAmountInr: principalDigits,
      interestRate: emi.interestRate.trim() || "0",
      tenureMonths: tenure,
      startDate: emi.startDate,
      emiDueDay: emiDay,
      dueDateCycle: emi.dueCycle,
      overrideEmiAmountOn: emi.overrideEmi,
    }

    try {
      await createAccount(payload).unwrap()
      toast.success("Loan account created successfully")
      resetForm()
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

  const fieldBase =
    "flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50"
  
  const labelClass = "mb-1.5 block text-xs font-semibold text-foreground/80"

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 max-h-dvh items-center justify-center overflow-hidden p-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-4">
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
          "relative flex mb-8 min-h-0 max-h-[min(calc(100dvh-1.25rem-env(safe-area-inset-bottom)),92dvh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
            Add Loan
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              FORM_OVERLAY_SCROLL_BODY,
              "space-y-4 px-5 py-5" // Increased spacing and padding
            )}
          >
            <section>
              <Label htmlFor={loanTypeId} className={labelClass}>
                Loan Type
              </Label>
              <div className="relative">
                <select
                  id={loanTypeId}
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  className={cn(fieldBase, "appearance-none pr-9 border-primary")} // Removed explicit heights to rely on fieldBase
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
              <Label htmlFor="loan-name" className={labelClass}>
                Loan Name
              </Label>
              <Input
                id="loan-name"
                value={loanName}
                onChange={(e) => setLoanName(e.target.value)}
                placeholder="e.g. Home Loan - SBI"
                className={fieldBase} // Removed height override
              />
            </section>

            {/* Removed 'compact' and 'loanSheetDense' so children render at normal sizes */}
            <LoanEmiFormFields value={emi} onChange={patchEmi} showOverdue />
          </div>

          <div className={cn(FORM_OVERLAY_FOOTER, "px-5  ")}>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60 sm:h-11 sm:text-base"
            >
              {isSubmitting ? "Saving..." : "Add Loan"}
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