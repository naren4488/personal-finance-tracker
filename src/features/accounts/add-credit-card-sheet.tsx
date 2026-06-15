import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useId } from "react"
import { useForm } from "react-hook-form"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/form-dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { BILLING_DAY_OPTIONS } from "@/lib/billing-day-options"
import {
  type CreateAccountRequest,
  parseOptionalFormDecimal,
  parseOptionalFormInt,
} from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import {
  creditCardCreateDefaultValues,
  creditCardCreateFormSchema,
  type CreditCardCreateFormValues,
} from "@/lib/forms/credit-card-create-schema"
import { handleAuthApiErrorIfNeeded } from "@/lib/auth/handle-auth-api-error"
import {
  APP_FORM_FIELD_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SELECT_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_TITLE_CLASS,
  APP_FORM_TWO_COL_GRID_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"
import { useCreateAccountMutation } from "@/store/api/base-api"
import { useAppDispatch } from "@/store/hooks"

const CARD_NETWORKS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "rupay", label: "RuPay" },
  { value: "american_express", label: "American Express" },
  { value: "other", label: "Other" },
] as const

function SelectChevron() {
  return (
    <ChevronDown
      className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  )
}

export type AddCreditCardSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MountedProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddCreditCardSheetMounted({ open, onOpenChange }: MountedProps) {
  const dispatch = useAppDispatch()
  const titleId = useId()
  const networkSelectId = useId()
  const billDaySelectId = useId()
  const dueDaySelectId = useId()

  const [createAccount, { isLoading: isSubmitting }] = useCreateAccountMutation()

  const form = useForm<CreditCardCreateFormValues>({
    resolver: zodResolver(creditCardCreateFormSchema),
    defaultValues: creditCardCreateDefaultValues,
    mode: "onSubmit",
    reValidateMode: "onChange",
  })

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const showSubmitError = useCallback(
    (message: string) => {
      const msg = message.trim() || "Unable to create credit card."
      form.setError("root", { type: "server", message: msg })
      toast.error(msg)
    },
    [form]
  )

  const onSubmit = form.handleSubmit(async (values) => {
    form.clearErrors("root")

    const name = values.cardName.trim()
    const bank = values.bankName.trim()
    const network = values.cardNetwork.trim().toLowerCase()
    const l4 = values.last4.replace(/\D/g, "")
    const limitDigits = values.creditLimit.replace(/\D/g, "")
    const limit = Number(limitDigits)
    const billDay = Number(values.billDay)
    const dueDay = Number(values.dueDay)

    if (!name) {
      form.setError("cardName", { message: "Enter card name" })
      return
    }
    if (!bank) {
      form.setError("bankName", { message: "Enter bank name" })
      return
    }
    if (!network) {
      form.setError("cardNetwork", { message: "Select card network" })
      return
    }
    if (l4.length !== 4) {
      form.setError("last4", { message: "Enter last 4 digits" })
      return
    }
    if (!Number.isFinite(limit) || limit <= 0) {
      form.setError("creditLimit", { message: "Enter valid credit limit" })
      return
    }
    if (!Number.isFinite(billDay) || billDay < 1 || billDay > 31) {
      form.setError("billDay", { message: "Select bill generation day" })
      return
    }
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) {
      form.setError("dueDay", { message: "Select payment due day" })
      return
    }

    const outstanding = Number(values.outstanding.replace(/\D/g, "")) || 0

    if (outstanding > limit) {
      form.setError("outstanding", { message: "Outstanding cannot exceed credit limit" })
      return
    }

    const payload: CreateAccountRequest = {
      name,
      kind: "credit_card",
      balanceInr: outstanding,
      bankName: bank,
      isActive: true,
      cardNetwork: network,
      last4Digits: l4,
      creditLimitInr: limit,
      billGenerationDay: billDay,
      paymentDueDay: dueDay,
      cardInterestRate: parseOptionalFormDecimal(values.cardInterestRate),
      minDuePercent: parseOptionalFormDecimal(values.minDuePercent),
      minDueFloor: parseOptionalFormInt(values.minDueFloor),
    }

    try {
      await createAccount(payload).unwrap()
      toast.success("Account created successfully")
      form.reset(creditCardCreateDefaultValues)
      dismiss()
    } catch (err) {
      if (handleAuthApiErrorIfNeeded(err, dispatch, { onDismiss: dismiss })) return
      showSubmitError(getErrorMessage(err))
    }
  })

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Add Credit Card"
      header={
        <header className={cn(APP_FORM_HEADER_CLASS, "flex items-center justify-between gap-2")}>
          <h2 id={titleId} className={APP_FORM_TITLE_CLASS}>
            Add Credit Card
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
      formProps={{ onSubmit: (e) => void onSubmit(e), noValidate: true }}
      footer={
        <Button type="submit" disabled={isSubmitting} className={APP_FORM_SUBMIT_CLASS}>
          {isSubmitting ? "Saving..." : "Add Credit Card"}
        </Button>
      }
    >
      <Form {...form}>
        <div className={cn(APP_FORM_STACK_CLASS, "min-w-0")} aria-live="polite">
          {form.formState.errors.root?.message ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <FormField
            control={form.control}
            name="cardName"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={APP_FORM_LABEL_CLASS}>Card Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. HDFC Regalia"
                    className={APP_FORM_FIELD_CLASS}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className={APP_FORM_TWO_COL_GRID_CLASS}>
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel className={APP_FORM_LABEL_CLASS}>Bank Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. HDFC"
                      className={APP_FORM_FIELD_CLASS}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cardNetwork"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel htmlFor={networkSelectId} className={APP_FORM_LABEL_CLASS}>
                    Card Network
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <select
                        id={networkSelectId}
                        className={cn(APP_FORM_SELECT_CLASS, "border-primary")}
                        {...field}
                        value={field.value ?? ""}
                      >
                        <option value="">Select</option>
                        {CARD_NETWORKS.map((n) => (
                          <option key={n.value} value={n.value}>
                            {n.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <SelectChevron />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className={APP_FORM_TWO_COL_GRID_CLASS}>
            <FormField
              control={form.control}
              name="last4"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel className={APP_FORM_LABEL_CLASS}>Last 4 Digits</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="1234"
                      className={APP_FORM_FIELD_CLASS}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ""))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="creditLimit"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel className={APP_FORM_LABEL_CLASS}>Credit Limit (₹)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="numeric"
                      placeholder="0"
                      className={APP_FORM_FIELD_CLASS}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ""))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="outstanding"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={APP_FORM_LABEL_CLASS}>Current Outstanding (₹)</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="0"
                    className={APP_FORM_FIELD_CLASS}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className={APP_FORM_TWO_COL_GRID_CLASS}>
            <FormField
              control={form.control}
              name="billDay"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel htmlFor={billDaySelectId} className={APP_FORM_LABEL_CLASS}>
                    Bill Generation Day
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <select
                        id={billDaySelectId}
                        className={APP_FORM_SELECT_CLASS}
                        {...field}
                        value={field.value ?? ""}
                      >
                        {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <SelectChevron />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDay"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel htmlFor={dueDaySelectId} className={APP_FORM_LABEL_CLASS}>
                    Payment Due Day
                  </FormLabel>
                  <div className="relative">
                    <FormControl>
                      <select
                        id={dueDaySelectId}
                        className={APP_FORM_SELECT_CLASS}
                        {...field}
                        value={field.value ?? ""}
                      >
                        {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <SelectChevron />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className={APP_FORM_TWO_COL_GRID_CLASS}>
            <FormField
              control={form.control}
              name="cardInterestRate"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel className={APP_FORM_LABEL_CLASS}>Interest Rate (%)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="3.5"
                      className={APP_FORM_FIELD_CLASS}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value.replace(/[^\d.]/g, ""))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="minDuePercent"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel className={APP_FORM_LABEL_CLASS}>Min Due (%)</FormLabel>
                  <FormControl>
                    <Input
                      inputMode="decimal"
                      placeholder="5"
                      className={APP_FORM_FIELD_CLASS}
                      name={field.name}
                      onBlur={field.onBlur}
                      ref={field.ref}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value.replace(/[^\d.]/g, ""))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="minDueFloor"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={APP_FORM_LABEL_CLASS}>Minimum Due Floor (₹)</FormLabel>
                <FormControl>
                  <Input
                    inputMode="numeric"
                    placeholder="3000"
                    className={APP_FORM_FIELD_CLASS}
                    name={field.name}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ""))}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Minimum fixed rupee amount payable as card minimum due.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>
    </FormDialog>
  )
}

export function AddCreditCardSheet({ open, onOpenChange }: AddCreditCardSheetProps) {
  if (!open) return null
  return <AddCreditCardSheetMounted open={open} onOpenChange={onOpenChange} />
}
