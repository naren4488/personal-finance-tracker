import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useId, useMemo } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Banknote, Building2, Landmark, type LucideIcon, Smartphone, Wallet, X } from "lucide-react"
import { toast } from "sonner"
import { AppFormInputField } from "@/components/app-form-fields"
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
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { type CreateAccountRequest } from "@/lib/api/account-schemas"
import {
  accountCreateFormSchema,
  balanceDigitsFromForm,
  type AccountCreateFormValues,
} from "@/lib/forms/account-create-schema"
import { handleFormApiError } from "@/lib/forms/form-api-errors"
import { isAccountCreateApiDisabled } from "@/lib/feature-flags"
import { useAppDispatch } from "@/store/hooks"
import {
  APP_FORM_FIELD_EMPHASIS_CLASS,
  APP_FORM_HEADER_CLASS,
  APP_FORM_LABEL_CLASS,
  APP_FORM_SECTION_HEADING_CLASS,
  APP_FORM_STACK_CLASS,
  APP_FORM_SUBMIT_CLASS,
  APP_FORM_SWITCH_ROW_CLASS,
  APP_FORM_TITLE_CLASS,
} from "@/lib/ui/app-form-styles"
import { cn } from "@/lib/utils"
import { useCreateAccountMutation } from "@/store/api/base-api"

const ACCOUNT_TYPE_OPTIONS: {
  id: string
  label: string
  description: string
  Icon: LucideIcon
}[] = [
  {
    id: "bank",
    label: "Bank Account",
    description: "Savings or current bank account.",
    Icon: Landmark,
  },
  {
    id: "cash",
    label: "Cash",
    description: "Physical cash you carry or store.",
    Icon: Banknote,
  },
  {
    id: "wallet",
    label: "Digital Wallet",
    description: "Paytm, PhonePe, or other wallets.",
    Icon: Wallet,
  },
  {
    id: "upi",
    label: "UPI Account",
    description: "UPI-linked bank account.",
    Icon: Smartphone,
  },
  {
    id: "asset",
    label: "Asset / Investment",
    description: "Track assets like property, vehicles, investments.",
    Icon: Building2,
  },
]

function submitLabelFor(accountType: string): string {
  switch (accountType) {
    case "bank":
      return "Add Bank Account"
    case "cash":
      return "Add Cash"
    case "wallet":
      return "Add Digital Wallet"
    case "upi":
      return "Add UPI Account"
    case "asset":
      return "Add Asset"
    default:
      return "Add Account"
  }
}

export type AddAccountSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MountedProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function AddAccountSheetMounted({ open, onOpenChange }: MountedProps) {
  const dispatch = useAppDispatch()
  const titleId = useId()

  const [createAccount, { isLoading: isSubmitting }] = useCreateAccountMutation()
  const accountCreateDisabled = isAccountCreateApiDisabled()

  const form = useForm<AccountCreateFormValues>({
    resolver: zodResolver(accountCreateFormSchema),
    defaultValues: {
      accountType: "bank",
      name: "",
      bankName: "",
      balance: "",
      isActive: true,
    },
  })

  const accountType = useWatch({ control: form.control, name: "accountType" })
  const isActive = useWatch({ control: form.control, name: "isActive" })

  const dismiss = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const firstFour = useMemo(() => ACCOUNT_TYPE_OPTIONS.slice(0, 4), [])
  const fifth = ACCOUNT_TYPE_OPTIONS[4]
  const FifthIcon = fifth?.Icon

  const onSubmit = form.handleSubmit(async (values) => {
    if (accountCreateDisabled) {
      toast.message("Coming soon", {
        description: "Account creation will work once the server API is enabled.",
      })
      return
    }

    const payload: CreateAccountRequest = {
      name: values.name.trim(),
      kind: values.accountType,
      balanceInr: balanceDigitsFromForm(values.balance),
      bankName: values.bankName.trim(),
      isActive: values.isActive,
    }

    try {
      const result = await createAccount(payload).unwrap()
      toast.success(result.message ?? "Account created successfully")
      dismiss()
    } catch (err) {
      handleFormApiError(err, dispatch, { onDismiss: dismiss })
    }
  })

  const typeTileClass =
    "flex min-h-0 min-w-0 max-w-full items-start gap-2 overflow-hidden rounded-2xl border-2 bg-card p-2.5 text-left transition-[border-color,box-shadow,background-color] sm:gap-2.5 sm:p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      accessibilityTitle="Add Account"
      contentClassName="sm:rounded-3xl"
      formProps={{ onSubmit: (e) => void onSubmit(e) }}
      footer={
        <Button
          type="submit"
          disabled={isSubmitting || accountCreateDisabled}
          className={APP_FORM_SUBMIT_CLASS}
        >
          {accountCreateDisabled
            ? "Unavailable"
            : isSubmitting
              ? "Saving…"
              : submitLabelFor(accountType)}
        </Button>
      }
      header={
        <header className={APP_FORM_HEADER_CLASS}>
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className={APP_FORM_TITLE_CLASS}>
              Add Account
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
              onClick={dismiss}
            >
              <X className="size-5" strokeWidth={2} />
            </Button>
          </div>
          <div className="mt-2 text-center sm:mt-3">
            <p className="text-sm font-semibold text-foreground sm:text-base">
              Where do you keep money?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Add a money source to start tracking balances
            </p>
          </div>
        </header>
      }
    >
      <Form {...form}>
        <div className={APP_FORM_STACK_CLASS}>
          {accountCreateDisabled ? (
            <div
              role="status"
              className="rounded-2xl border border-amber-500/40 bg-amber-500/12 px-4 py-3.5 text-sm text-foreground sm:px-4 sm:py-4"
            >
              <p className="font-semibold text-amber-950 dark:text-amber-100">
                Account creation is turned off
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                Nothing is sent to the server while this mode is on. Delete{" "}
                <code className="rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[11px]">
                  VITE_DISABLE_ACCOUNT_CREATE
                </code>{" "}
                from{" "}
                <code className="rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[11px]">
                  .env.local
                </code>{" "}
                (or set it to false) after the add-account API is deployed.
              </p>
            </div>
          ) : null}

          <section className="space-y-3 sm:space-y-3.5" aria-labelledby="account-type-heading">
            <p id="account-type-heading" className={APP_FORM_SECTION_HEADING_CLASS}>
              Account type
            </p>
            <div className="space-y-2.5 sm:space-y-3">
              <div className="grid min-w-0 grid-cols-2 gap-2.5 sm:[grid-template-columns:repeat(2,minmax(0,1fr))] sm:gap-3">
                {firstFour.map(({ id, label, description, Icon }) => {
                  const selected = accountType === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        form.setValue("accountType", id)
                        form.clearErrors("bankName")
                      }}
                      className={cn(
                        typeTileClass,
                        selected
                          ? "border-primary bg-primary/8 shadow-sm dark:bg-primary/15"
                          : "border-border/80 hover:border-muted-foreground/40 hover:bg-muted/30"
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/80 sm:size-10">
                        <Icon
                          className="size-[18px] text-primary sm:size-5"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold leading-snug text-foreground sm:text-[13px]">
                          {label}
                        </span>
                        <span className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                          {description}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {fifth ? (
                <button
                  key={fifth.id}
                  type="button"
                  role="radio"
                  aria-checked={accountType === fifth.id}
                  onClick={() => {
                    form.setValue("accountType", fifth.id)
                    form.clearErrors("bankName")
                  }}
                  className={cn(
                    typeTileClass,
                    "w-full",
                    accountType === fifth.id
                      ? "border-primary bg-primary/8 shadow-sm dark:bg-primary/15"
                      : "border-border/80 hover:border-muted-foreground/40 hover:bg-muted/30"
                  )}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/80 sm:size-10">
                    {FifthIcon ? (
                      <FifthIcon
                        className="size-[18px] text-primary sm:size-5"
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold leading-snug text-foreground sm:text-[13px]">
                      {fifth.label}
                    </span>
                    <span className="mt-1 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                      {fifth.description}
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
          </section>

          <AppFormInputField
            control={form.control}
            name="name"
            label="Name"
            placeholder="e.g. SBI Savings, HDFC Current"
          />

          {!["cash", "wallet", "upi"].includes(accountType) ? (
            <div className="space-y-2 sm:space-y-2.5">
              <AppFormInputField
                control={form.control}
                name="bankName"
                label="Bank / institution"
                placeholder="e.g. SBI, HDFC, Paytm"
              />
              <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                Sent as <code className="rounded bg-muted px-1 py-0.5 text-[10px]">bankName</code>.
              </p>
            </div>
          ) : null}

          <section className={APP_FORM_SWITCH_ROW_CLASS}>
            <div className="min-w-0 space-y-0.5">
              <Label
                htmlFor="account-active"
                className="text-xs font-bold text-foreground sm:text-sm"
              >
                Active account
              </Label>
              <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                Inactive accounts stay hidden from most flows
              </p>
            </div>
            <Switch
              id="account-active"
              checked={isActive}
              onCheckedChange={(v) => form.setValue("isActive", v)}
              aria-label="Account active"
              className="shrink-0"
            />
          </section>

          <FormField
            control={form.control}
            name="balance"
            render={({ field }) => (
              <FormItem className="space-y-2 sm:space-y-2.5">
                <FormLabel className={APP_FORM_LABEL_CLASS}>Current balance (₹)</FormLabel>
                <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                  Check your bank app for the latest amount
                </p>
                <FormControl>
                  <input
                    inputMode="numeric"
                    placeholder="0"
                    className={APP_FORM_FIELD_EMPHASIS_CLASS}
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value.replace(/[^\d]/g, ""))}
                    onBlur={field.onBlur}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </Form>
    </FormDialog>
  )
}

export function AddAccountSheet({ open, onOpenChange }: AddAccountSheetProps) {
  if (!open) return null
  return <AddAccountSheetMounted open={open} onOpenChange={onOpenChange} />
}
