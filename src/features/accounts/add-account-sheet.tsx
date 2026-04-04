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
    "h-11 w-full rounded-2xl border border-border/80 bg-background px-4 text-sm text-foreground shadow-sm transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground/65 hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-12"

  const balanceInputClass =
    "h-12 w-full rounded-2xl border border-border/80 bg-background px-4 text-center text-lg font-semibold tabular-nums text-primary shadow-sm transition-[color,box-shadow,border-color] outline-none placeholder:text-primary/35 hover:border-border focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-14 sm:text-xl"

  const typeTileClass =
    "flex min-h-0 items-start gap-2 rounded-2xl border-2 bg-card p-2.5 text-left transition-[border-color,box-shadow,background-color] sm:gap-2.5 sm:p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"

  const sectionLabelClass =
    "mb-2 block text-xs font-bold uppercase tracking-wide text-primary/90 sm:text-[13px] sm:normal-case sm:tracking-normal"

  return (
    <div className="fixed inset-0 z-50 flex min-h-0 max-h-dvh items-center justify-center overflow-hidden p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
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
          "relative flex min-h-0 w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border/90 bg-card shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25)] ring-1 ring-black/4 dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.55)] dark:ring-white/6",
          "max-h-[min(calc(100dvh-1.5rem-env(safe-area-inset-bottom)),92dvh)] sm:max-h-[min(90dvh,calc(100dvh-2.5rem))] sm:rounded-3xl lg:max-w-xl",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        <header className="shrink-0 border-b border-border/80 bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-lg font-bold tracking-tight text-primary sm:text-xl">
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              FORM_OVERLAY_SCROLL_BODY,
              "space-y-6 px-4 py-5 pb-6! sm:space-y-7 sm:px-6 sm:py-6 sm:pb-8!"
            )}
          >
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
              <p id="account-type-heading" className={sectionLabelClass}>
                Account type
              </p>
              <div className="space-y-2.5 sm:space-y-3">
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
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
                    onClick={() => setAccountType(fifth.id)}
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

            <section className="space-y-2 sm:space-y-2.5">
              <Label
                htmlFor={nameId}
                className={cn(sectionLabelClass, "mb-0 normal-case tracking-normal")}
              >
                Name
              </Label>
              <Input
                id={nameId}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. SBI Savings, HDFC Current"
                className={fieldClass}
              />
            </section>

            <section
              className={cn(
                "flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/25 px-4 py-3.5 sm:px-5 sm:py-4",
                "shadow-sm"
              )}
            >
              <div className="min-w-0 space-y-0.5">
                <Label
                  htmlFor="account-emi-due"
                  className="text-xs font-bold text-foreground sm:text-sm"
                >
                  EMI due
                </Label>
                <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                  Track EMIs on this account
                </p>
              </div>
              <Switch
                id="account-emi-due"
                checked={emiDue}
                onCheckedChange={setEmiDue}
                aria-label="EMI due tracking"
                className="shrink-0"
              />
            </section>

            {!emiDue ? (
              <section className="space-y-2 sm:space-y-2.5">
                <div className="space-y-2">
                  <Label
                    htmlFor={balanceId}
                    className={cn(sectionLabelClass, "mb-0 normal-case tracking-normal")}
                  >
                    Current balance (₹)
                  </Label>
                  <p className="text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                    Check your bank app for the latest amount
                  </p>
                  <Input
                    id={balanceId}
                    inputMode="numeric"
                    placeholder="0"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value.replace(/[^\d]/g, ""))}
                    className={balanceInputClass}
                  />
                </div>
              </section>
            ) : (
              <section className="space-y-2">
                <LoanEmiFormFields value={emi} onChange={patchEmi} compact showOverdue={false} />
              </section>
            )}
          </div>

          <div
            className={cn(
              FORM_OVERLAY_FOOTER,
              "border-t border-border/80 bg-card/95 px-4 py-3 backdrop-blur-md supports-backdrop-filter:bg-card/90 sm:px-6 sm:py-4"
            )}
          >
            <Button
              type="submit"
              disabled={isSubmitting || accountCreateDisabled}
              className="h-11 w-full rounded-2xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white shadow-md transition-[transform,box-shadow] hover:bg-[hsl(230_22%_56%)] hover:shadow-lg active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60 sm:h-12 sm:text-base"
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
