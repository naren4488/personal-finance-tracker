import { useCallback, useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
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
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddLoanSheetMounted({ open, onOpenChange }: MountedProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const titleId = useId()
  const loanTypeId = useId()

  const [loanType, setLoanType] = useState<string>(LOAN_TYPES[0])
  const [loanName, setLoanName] = useState("")
  const [emi, setEmi] = useState<LoanEmiFormModel>(() => createInitialLoanEmiModel())
  const [createAccount, { isLoading: isSubmitting }] = useCreateAccountMutation()

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

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
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Add Loan"
      header={
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
      }
      formProps={{ onSubmit: (e) => void handleSubmit(e) }}
      footer={
        <Button
          type="submit"
          disabled={isSubmitting}
          className="h-10 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60 sm:h-11 sm:text-base"
        >
          {isSubmitting ? "Saving..." : "Add Loan"}
        </Button>
      }
    >
      <div className="space-y-4 px-5 py-5">
        <section>
          <Label htmlFor={loanTypeId} className={labelClass}>
            Loan Type
          </Label>
          <div className="relative">
            <select
              id={loanTypeId}
              value={loanType}
              onChange={(e) => setLoanType(e.target.value)}
              className={cn(fieldBase, "appearance-none pr-9 border-primary")}
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
            className={fieldBase}
          />
        </section>

        <LoanEmiFormFields value={emi} onChange={patchEmi} showOverdue />
      </div>
    </FormDialog>
  )
}

export function AddLoanSheet({ open, onOpenChange }: AddLoanSheetProps) {
  if (!open) return null
  return <AddLoanSheetMounted open={open} onOpenChange={onOpenChange} />
}
