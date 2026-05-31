import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect, useId } from "react"
import { useForm } from "react-hook-form"
import { Scale, X } from "lucide-react"
import { toast } from "sonner"
import { AppFormInputField, AppFormTextareaField } from "@/components/app-form-fields"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import { Form } from "@/components/ui/form"
import type { Account } from "@/lib/api/account-schemas"
import {
  accountAvailableBalanceInrFromApi,
  formatOpeningBalanceForApi,
} from "@/lib/api/account-schemas"
import {
  adjustBalanceFormSchema,
  type AdjustBalanceFormValues,
} from "@/lib/forms/adjust-balance-schema"
import { handleFormApiError } from "@/lib/forms/form-api-errors"
import { signOutAndRedirectToLogin } from "@/lib/auth/sign-out-and-redirect"
import { formatCurrency } from "@/lib/format"
import {
  APP_FORM_FIELD_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"
import { useCreateAccountBalanceAdjustmentMutation } from "@/store/api/base-api"
import { selectIsAuthenticated } from "@/store/auth-selectors"
import { useAppDispatch, useAppSelector } from "@/store/hooks"

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function parseAmountToNumber(s: string): number | null {
  const t = s.replace(/,/g, "").trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function initialValuesForAccount(account: Account): AdjustBalanceFormValues {
  const current = accountAvailableBalanceInrFromApi(account)
  return {
    targetBalance: formatOpeningBalanceForApi(current),
    date: todayIsoDate(),
    reason: "",
    note: "",
  }
}

type MountedProps = {
  open: boolean
  account: Account
  onOpenChange: (open: boolean) => void
}

function AdjustBalanceSheetMounted({ open, account, onOpenChange }: MountedProps) {
  const titleId = useId()
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const [adjust, { isLoading }] = useCreateAccountBalanceAdjustmentMutation()

  const form = useForm<AdjustBalanceFormValues>({
    resolver: zodResolver(adjustBalanceFormSchema),
    defaultValues: initialValuesForAccount(account),
  })

  const accountName = account.name?.trim() || "Account"
  const currentBalanceInr = accountAvailableBalanceInrFromApi(account)

  useEffect(() => {
    form.reset(initialValuesForAccount(account))
  }, [account, form])

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!isAuthenticated) {
      signOutAndRedirectToLogin(dispatch, "authorization token is required")
      dismiss()
      return
    }

    const n = parseAmountToNumber(values.targetBalance)
    if (n === null) return

    const accountId = String(account.id ?? "").trim()
    if (!accountId) {
      toast.error("Missing account id")
      return
    }

    try {
      const result = await adjust({
        accountId,
        body: {
          targetCurrentBalance: formatOpeningBalanceForApi(n),
          date: values.date.trim(),
          reason: values.reason.trim(),
          ...(values.note.trim() ? { note: values.note.trim() } : {}),
        },
      }).unwrap()

      const msg =
        result.message?.trim() && result.message.trim().length > 0
          ? result.message.trim()
          : "Balance adjustment saved"
      toast.success(msg)
      dismiss()
    } catch (err) {
      handleFormApiError(err, dispatch, { onDismiss: dismiss })
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Adjust balance"
      header={
        <header className={cn(APP_FORM_HEADER_CLASS, "flex items-start justify-between gap-2")}>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
              Adjust balance
            </h2>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{accountName}</p>
          </div>
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
      }
      formProps={{ onSubmit: (e) => void onSubmit(e) }}
      footer={
        <Button type="submit" disabled={isLoading} className={APP_FORM_SUBMIT_CLASS}>
          {isLoading ? "Saving…" : "Save adjustment"}
        </Button>
      }
    >
      <Form {...form}>
        <div className={APP_FORM_STACK_CLASS}>
          <div className="flex items-start gap-3 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5">
            <Scale className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 text-sm">
              <p className="font-medium text-foreground">Current balance (reference)</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">
                {formatCurrency(currentBalanceInr)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the balance that should match your bank statement. The server applies the
                difference — you do not enter the adjustment amount here.
              </p>
            </div>
          </div>

          <AppFormInputField
            control={form.control}
            name="targetBalance"
            label="Target balance"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
          />

          <AppFormInputField
            control={form.control}
            name="date"
            label="Date"
            type="date"
            className="scheme-light dark:scheme-dark"
            inputClassName={cn(APP_FORM_FIELD_CLASS, "scheme-light dark:scheme-dark")}
          />

          <AppFormInputField
            control={form.control}
            name="reason"
            label="Reason"
            placeholder="e.g. reconciled with bank statement"
            autoComplete="off"
          />

          <AppFormTextareaField
            control={form.control}
            name="note"
            label={
              <>
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </>
            }
            placeholder="Optional details"
          />
        </div>
      </Form>
    </FormDialog>
  )
}

export type AdjustBalanceSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
}

/** Renders only while open so form state resets when closed. */
export function AdjustBalanceSheet({ open, onOpenChange, account }: AdjustBalanceSheetProps) {
  if (!open || !account) return null
  return <AdjustBalanceSheetMounted open={open} account={account} onOpenChange={onOpenChange} />
}
