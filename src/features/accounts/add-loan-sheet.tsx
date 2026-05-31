import { useCallback, useId, useMemo, useState } from "react"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { AppFieldError } from "@/components/app-field-error"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  filterRepaymentSourceAccounts,
  loanTypeLabelToApiSlug,
  type CreateAccountRequest,
} from "@/lib/api/account-schemas"
import { loanCreateFormSchema } from "@/lib/forms/loan-create-schema"
import { handleFormApiError } from "@/lib/forms/form-api-errors"
import { zodErrorToFieldMap } from "@/lib/forms/zod-helpers"
import { LoanEmiFormFields } from "@/features/accounts/loan-emi-form-fields"
import {
  createInitialLoanEmiModel,
  resolveEmiDueDayForLoanSubmit,
  type LoanEmiFormModel,
} from "@/features/accounts/loan-emi-model"
import {
  APP_FORM_FIELD_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SELECT_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_TITLE_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"
import { useCreateAccountMutation, useGetAccountsQuery } from "@/store/api/base-api"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

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
  const dispatch = useAppDispatch()
  const titleId = useId()
  const loanTypeId = useId()

  const [loanType, setLoanType] = useState<string>(LOAN_TYPES[0])
  const [loanName, setLoanName] = useState("")
  const [emi, setEmi] = useState<LoanEmiFormModel>(() => createInitialLoanEmiModel())
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [createAccount, { isLoading: isSubmitting }] = useCreateAccountMutation()
  const user = useAppSelector((s) => s.auth.user)
  const { data: accountsRaw = [], isLoading: accountsLoading } = useGetAccountsQuery(undefined, {
    skip: !user || !open,
  })
  const repaymentAccounts = useMemo(() => filterRepaymentSourceAccounts(accountsRaw), [accountsRaw])

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const patchEmi = useCallback((p: Partial<LoanEmiFormModel>) => {
    setEmi((s) => ({ ...s, ...p }))
  }, [])

  function resetForm() {
    setLoanType(LOAN_TYPES[0])
    setLoanName("")
    setEmi(createInitialLoanEmiModel())
    setFieldErrors({})
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const parsed = loanCreateFormSchema.safeParse({
      loanType,
      loanName,
      ...emi,
    })
    if (!parsed.success) {
      setFieldErrors(zodErrorToFieldMap(parsed.error))
      return
    }
    setFieldErrors({})

    const name = loanName.trim()
    const lender = emi.bankLender.trim()
    const p = emi.principal.replace(/\D/g, "")
    const tenure = Number(emi.tenureMonths.replace(/\D/g, "")) || 0
    const emiDay = resolveEmiDueDayForLoanSubmit(emi)!
    const overrideEmiDigits = emi.overrideEmi
      ? Number(emi.overrideEmiAmount.replace(/\D/g, "")) || 0
      : 0
    const linkedRepaymentId = emi.linkedRepaymentAccountId.trim()

    const principalDigits = Number(p)
    const balanceInr = principalDigits

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
      ...(emi.overrideEmi ? { overrideEmiAmountInr: overrideEmiDigits } : {}),
      ...(linkedRepaymentId ? { linkedRepaymentAccountId: linkedRepaymentId } : {}),
    }

    try {
      await createAccount(payload).unwrap()
      toast.success("Loan account created successfully")
      resetForm()
      dismiss()
    } catch (err) {
      handleFormApiError(err, dispatch, { onDismiss: dismiss })
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Add Loan"
      header={
        <header className={cn(APP_FORM_HEADER_CLASS, "flex items-center justify-between gap-2")}>
          <h2 id={titleId} className={APP_FORM_TITLE_CLASS}>
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
        <Button type="submit" disabled={isSubmitting} className={APP_FORM_SUBMIT_CLASS}>
          {isSubmitting ? "Saving..." : "Add Loan"}
        </Button>
      }
    >
      <div className={APP_FORM_STACK_CLASS}>
        <section>
          <Label htmlFor={loanTypeId} className={APP_FORM_LABEL_CLASS}>
            Loan Type
          </Label>
          <div className="relative">
            <select
              id={loanTypeId}
              value={loanType}
              onChange={(e) => setLoanType(e.target.value)}
              className={cn(APP_FORM_SELECT_CLASS, "border-primary")}
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
          <Label htmlFor="loan-name" className={APP_FORM_LABEL_CLASS}>
            Loan Name
          </Label>
          <Input
            id="loan-name"
            value={loanName}
            onChange={(e) => {
              setLoanName(e.target.value)
              if (fieldErrors.loanName) {
                setFieldErrors((fe) => {
                  const next = { ...fe }
                  delete next.loanName
                  return next
                })
              }
            }}
            placeholder="e.g. Home Loan - SBI"
            className={APP_FORM_FIELD_CLASS}
            aria-invalid={!!fieldErrors.loanName}
          />
          <AppFieldError message={fieldErrors.loanName} />
        </section>

        <LoanEmiFormFields
          value={emi}
          onChange={patchEmi}
          showOverdue={false}
          repaymentAccounts={repaymentAccounts}
          repaymentAccountsLoading={accountsLoading}
          fieldErrors={fieldErrors}
        />
      </div>
    </FormDialog>
  )
}

export function AddLoanSheet({ open, onOpenChange }: AddLoanSheetProps) {
  if (!open) return null
  return <AddLoanSheetMounted open={open} onOpenChange={onOpenChange} />
}
