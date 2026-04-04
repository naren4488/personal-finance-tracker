import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { Banknote, Building2, Landmark, type LucideIcon, Smartphone, Wallet, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { LoanEmiFormFields } from "@/features/accounts/loan-emi-form-fields"
import {
  createInitialLoanEmiModel,
  type LoanEmiFormModel,
} from "@/features/accounts/loan-emi-model"
import type { CreateAccountRequest } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { isAccountCreateApiDisabled } from "@/lib/feature-flags"
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
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
  onOpenChange: (open: boolean) => void
}

function AddAccountSheetMounted({ onOpenChange }: MountedProps) {
  const titleId = useId()
  const nameId = useId()
  const balanceId = useId()

  const [accountType, setAccountType] = useState<string>("bank")
  const [name, setName] = useState("")
  const [balance, setBalance] = useState("")
  const [emiDue, setEmiDue] = useState(false)
  const [emi, setEmi] = useState<LoanEmiFormModel>(() => createInitialLoanEmiModel())

  const [createAccount, { isLoading: isSubmitting }] = useCreateAccountMutation()
  const accountCreateDisabled = isAccountCreateApiDisabled()

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

  const firstFour = useMemo(() => ACCOUNT_TYPE_OPTIONS.slice(0, 4), [])
  const fifth = ACCOUNT_TYPE_OPTIONS[4]
  const FifthIcon = fifth?.Icon

  function patchEmi(p: Partial<LoanEmiFormModel>) {
    setEmi((s) => ({ ...s, ...p }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (accountCreateDisabled) {
      toast.message("Coming soon", {
        description: "Account creation will work once the server API is enabled.",
      })
      return
    }
    const n = name.trim()
    if (!n) {
      toast.error("Give your account a name")
      return
    }

    let initialBalanceInr = 0
    let emiLoan: CreateAccountRequest["emiLoan"] = undefined

    if (emiDue) {
      const p = emi.principal.replace(/\D/g, "")
      if (!p || Number(p) <= 0) {
        toast.error("Enter a valid principal amount")
        return
      }
      initialBalanceInr = Number(p)
      emiLoan = {
        bankLender: emi.bankLender.trim() || undefined,
        loanAccountNo: emi.loanAccountNo.trim() || undefined,
        principalInr: Number(p),
        interestRatePercent: Number(emi.interestRate.replace(/[^\d.]/g, "")) || 0,
        tenureMonths: Number(emi.tenureMonths.replace(/\D/g, "")) || 0,
        startDate: emi.startDate,
        emiDueDay: Number(emi.emiDueDay),
        dueDateCycle: emi.dueCycle,
        overrideEmi: emi.overrideEmi,
        customEmiAmountInr: emi.overrideEmi
          ? Number(emi.overrideEmiAmount.replace(/\D/g, "")) || 0
          : undefined,
      }
    } else {
      const digits = balance.replace(/\D/g, "")
      initialBalanceInr = digits === "" ? 0 : Number(digits)
    }

    try {
      await createAccount({
        name: n,
        accountType,
        initialBalanceInr,
        ...(emiLoan ? { emiLoan } : {}),
      }).unwrap()
      toast.success("Account added")
      dismiss()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const fieldClass =
    "h-8 w-full rounded-xl border border-border bg-muted/50 px-3 text-sm text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 sm:h-9"

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
          "relative flex min-h-0 max-h-[min(calc(100dvh-1.25rem-env(safe-area-inset-bottom)),92dvh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[min(92dvh,calc(100dvh-2rem))]",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="shrink-0 border-b border-border px-3 py-2 sm:px-4 sm:py-2.5">
          <div className="flex items-start justify-between gap-2">
            <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
              Add Account
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
          </div>
          <div className="mt-1.5 text-center sm:mt-2">
            <p className="text-sm font-bold text-primary">Where do you keep money?</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground sm:text-xs">
              Add a money source to start tracking balances
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              FORM_OVERLAY_SCROLL_BODY,
              "space-y-1.5 px-3 py-1.5 sm:space-y-2 sm:px-4 sm:py-2"
            )}
          >
            {accountCreateDisabled ? (
              <div
                role="status"
                className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2.5 text-xs text-foreground sm:text-sm"
              >
                <p className="font-semibold text-amber-950 dark:text-amber-100">
                  Account creation is turned off
                </p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  Nothing is sent to the server while this mode is on. Delete{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                    VITE_DISABLE_ACCOUNT_CREATE
                  </code>{" "}
                  from{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
                    .env.local
                  </code>{" "}
                  (or set it to false) after the add-account API is deployed.
                </p>
              </div>
            ) : null}
            <div
              className={cn(
                "transition-transform duration-200",
                emiDue && "origin-top scale-[0.97] sm:scale-[0.98]"
              )}
            >
              <Label className="mb-1 block text-[11px] font-bold text-primary sm:text-xs">
                Account Type
              </Label>
              <div className="grid grid-cols-2 gap-1 sm:gap-1.5">
                {firstFour.map(({ id, label, description, Icon }) => {
                  const selected = accountType === id
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setAccountType(id)}
                      className={cn(
                        "flex min-h-0 items-start gap-1.5 rounded-xl border-2 bg-card p-1.5 text-left transition-colors sm:gap-2 sm:p-2",
                        selected
                          ? "border-primary bg-sky-50 dark:bg-primary/15"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted sm:size-9">
                        <Icon
                          className="size-4 text-primary sm:size-[18px]"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-bold leading-tight text-foreground sm:text-xs">
                          {label}
                        </span>
                        <span className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-muted-foreground sm:text-[10px]">
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
                  onClick={() => setAccountType(fifth.id)}
                  className={cn(
                    "mt-1 flex w-full items-start gap-1.5 rounded-xl border-2 bg-card p-1.5 text-left transition-colors sm:mt-1.5 sm:gap-2 sm:p-2",
                    accountType === fifth.id
                      ? "border-primary bg-sky-50 dark:bg-primary/15"
                      : "border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted sm:size-9">
                    {FifthIcon ? (
                      <FifthIcon
                        className="size-4 text-primary sm:size-[18px]"
                        strokeWidth={2}
                        aria-hidden
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-bold leading-tight text-foreground sm:text-xs">
                      {fifth.label}
                    </span>
                    <span className="mt-0.5 text-[9px] leading-snug text-muted-foreground sm:text-[10px]">
                      {fifth.description}
                    </span>
                  </span>
                </button>
              ) : null}
            </div>

            <div>
              <Label
                htmlFor={nameId}
                className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
              >
                Give it a name
              </Label>
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SBI Savings, HDFC Current"
                className={cn(fieldClass, "bg-muted/50")}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 px-2.5 py-1.5 sm:px-3 sm:py-2">
              <div className="min-w-0">
                <Label
                  htmlFor="account-emi-due"
                  className="text-[11px] font-bold text-primary sm:text-xs"
                >
                  EMI Due
                </Label>
                <p className="text-[9px] text-muted-foreground sm:text-[10px]">
                  Track EMIs on this account
                </p>
              </div>
              <Switch
                id="account-emi-due"
                checked={emiDue}
                onCheckedChange={setEmiDue}
                aria-label="EMI due tracking"
              />
            </div>

            {!emiDue ? (
              <div>
                <Label
                  htmlFor={balanceId}
                  className="mb-0.5 block text-[11px] font-bold text-primary sm:text-xs"
                >
                  How much is in here right now? (₹)
                </Label>
                <p className="mb-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                  Check your bank app for the current balance
                </p>
                <Input
                  id={balanceId}
                  inputMode="numeric"
                  placeholder="0"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value.replace(/[^\d]/g, ""))}
                  className="h-9 rounded-xl border-border bg-muted/60 text-center text-lg font-semibold tabular-nums text-primary/80 placeholder:text-primary/40 sm:h-10 sm:text-xl"
                />
              </div>
            ) : (
              <LoanEmiFormFields value={emi} onChange={patchEmi} compact showOverdue={false} />
            )}
          </div>

          <div className={FORM_OVERLAY_FOOTER}>
            <Button
              type="submit"
              disabled={isSubmitting || accountCreateDisabled}
              className="h-9 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] disabled:opacity-60 sm:h-10 sm:text-base"
            >
              {accountCreateDisabled
                ? "Unavailable"
                : isSubmitting
                  ? "Saving…"
                  : submitLabelFor(accountType)}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AddAccountSheet({ open, onOpenChange }: AddAccountSheetProps) {
  if (!open) return null
  return <AddAccountSheetMounted onOpenChange={onOpenChange} />
}
