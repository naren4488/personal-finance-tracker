import { useCallback, useEffect, useId, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { BILLING_DAY_OPTIONS } from "@/lib/billing-day-options"
import { type CreateAccountRequest } from "@/lib/api/account-schemas"
import { getErrorMessage } from "@/lib/api/errors"
import { endUserSession } from "@/lib/auth/end-session"
import { FORM_OVERLAY_FOOTER, FORM_OVERLAY_SCROLL_BODY } from "@/lib/form-overlay-scroll"
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

function SelectChevron({ compact }: { compact?: boolean }) {
  return (
    <ChevronDown
      className={cn(
        "pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground",
        compact ? "right-2 size-3.5" : "right-2.5 size-4"
      )}
      aria-hidden
    />
  )
}

export type AddCreditCardSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type MountedProps = {
  onOpenChange: (open: boolean) => void
}

function AddCreditCardSheetMounted({ onOpenChange }: MountedProps) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const titleId = useId()
  const networkId = useId()

  const [cardName, setCardName] = useState("")
  const [bankName, setBankName] = useState("")
  const [cardNetwork, setCardNetwork] = useState("")
  const [last4, setLast4] = useState("")
  const [creditLimit, setCreditLimit] = useState("")
  const [outstanding, setOutstanding] = useState("")
  const [billDay, setBillDay] = useState("1")
  const [dueDay, setDueDay] = useState("5")
  const [interestRate, setInterestRate] = useState("3.5")
  const [minDuePercent, setMinDuePercent] = useState("5")
  const [createAccount, { isLoading: isSubmitting }] = useCreateAccountMutation()

  const dismiss = useCallback(() => {
    document.body.style.overflow = ""
    onOpenChange(false)
  }, [onOpenChange])

  function resetForm() {
    setCardName("")
    setBankName("")
    setCardNetwork("")
    setLast4("")
    setCreditLimit("")
    setOutstanding("")
    setBillDay("1")
    setDueDay("5")
    setInterestRate("3.5")
    setMinDuePercent("5")
  }

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const name = cardName.trim()
    if (!name) {
      toast.error("Enter card name")
      return
    }
    const bank = bankName.trim()
    if (!bank) {
      toast.error("Enter bank name")
      return
    }
    if (!cardNetwork) {
      toast.error("Select card network")
      return
    }
    const l4 = last4.replace(/\D/g, "")
    if (l4.length !== 4) {
      toast.error("Enter last 4 digits")
      return
    }
    const limitDigits = creditLimit.replace(/\D/g, "")
    if (!limitDigits || Number(limitDigits) <= 0) {
      toast.error("Enter valid credit limit")
      return
    }
    if (!billDay) {
      toast.error("Select bill generation day")
      return
    }
    if (!dueDay) {
      toast.error("Select payment due day")
      return
    }

    const payload: CreateAccountRequest = {
      name,
      kind: "credit_card",
      balanceInr: Number(outstanding.replace(/\D/g, "")) || 0,
      bankName: bank,
      isActive: true,
      cardNetwork,
      last4Digits: l4,
      creditLimitInr: Number(limitDigits),
      billGenerationDay: Number(billDay),
      paymentDueDay: Number(dueDay),
    }

    try {
      await createAccount(payload).unwrap()
      toast.success("Account created successfully")
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

  const lb = "mb-0.5 block text-[10px] font-bold text-primary sm:text-xs"

  const fieldBase = cn(
    "w-full rounded-xl border border-border bg-muted/50 text-foreground shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
    "h-7 px-2 text-xs sm:h-8 sm:px-2.5 sm:text-sm"
  )

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
        <header className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-3 py-2 sm:px-4 sm:py-2.5">
          <h2 id={titleId} className="text-base font-bold text-primary sm:text-lg">
            Add Credit Card
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
          <div
            className={cn(
              FORM_OVERLAY_SCROLL_BODY,
              "space-y-1 px-3 py-1.5 sm:space-y-1.5 sm:px-4 sm:py-2"
            )}
          >
            <section>
              <Label htmlFor="cc-name" className={lb}>
                Card Name
              </Label>
              <Input
                id="cc-name"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="e.g. HDFC Regalia"
                className={cn(fieldBase)}
              />
            </section>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <section>
                <Label htmlFor="cc-bank" className={lb}>
                  Bank Name
                </Label>
                <Input
                  id="cc-bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC"
                  className={cn(fieldBase)}
                />
              </section>
              <section>
                <Label htmlFor={networkId} className={lb}>
                  Card Network
                </Label>
                <div className="relative">
                  <select
                    id={networkId}
                    value={cardNetwork}
                    onChange={(e) => setCardNetwork(e.target.value)}
                    className={cn(
                      fieldBase,
                      "appearance-none pr-7 sm:pr-9",
                      !cardNetwork && "text-muted-foreground"
                    )}
                  >
                    <option value="">Select</option>
                    {CARD_NETWORKS.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron compact />
                </div>
              </section>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <section>
                <Label htmlFor="cc-last4" className={lb}>
                  Last 4 Digits
                </Label>
                <Input
                  id="cc-last4"
                  inputMode="numeric"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="1234"
                  className={cn(fieldBase)}
                />
              </section>
              <section>
                <Label htmlFor="cc-limit" className={lb}>
                  Credit Limit (₹)
                </Label>
                <Input
                  id="cc-limit"
                  inputMode="numeric"
                  placeholder="0"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value.replace(/[^\d]/g, ""))}
                  className={cn(fieldBase)}
                />
              </section>
            </div>

            <section>
              <Label htmlFor="cc-out" className={lb}>
                Current Outstanding (₹)
              </Label>
              <Input
                id="cc-out"
                inputMode="numeric"
                placeholder="0 (if card already has usage)"
                value={outstanding}
                onChange={(e) => setOutstanding(e.target.value.replace(/[^\d]/g, ""))}
                className={cn(fieldBase)}
              />
              <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                Enter existing unpaid amount if any. Leave 0 for new cards.
              </p>
            </section>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <section>
                <Label htmlFor="cc-bill" className={lb}>
                  Bill Generation Date
                </Label>
                <div className="relative">
                  <select
                    id="cc-bill"
                    value={billDay}
                    onChange={(e) => setBillDay(e.target.value)}
                    className={cn(fieldBase, "appearance-none pr-7 sm:pr-9")}
                  >
                    {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron compact />
                </div>
                <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                  Day your bill is generated
                </p>
              </section>
              <section>
                <Label htmlFor="cc-due" className={lb}>
                  Payment Due Date
                </Label>
                <div className="relative">
                  <select
                    id="cc-due"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className={cn(fieldBase, "appearance-none pr-7 sm:pr-9")}
                  >
                    {BILLING_DAY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron compact />
                </div>
                <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">
                  Day your payment is due
                </p>
              </section>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <section>
                <Label htmlFor="cc-rate" className={lb}>
                  Interest Rate (%)
                </Label>
                <Input
                  id="cc-rate"
                  inputMode="decimal"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="3.5"
                  className={cn(fieldBase)}
                />
              </section>
              <section>
                <Label htmlFor="cc-min" className={lb}>
                  Min Due (%)
                </Label>
                <Input
                  id="cc-min"
                  inputMode="decimal"
                  value={minDuePercent}
                  onChange={(e) => setMinDuePercent(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="5"
                  className={cn(fieldBase)}
                />
              </section>
            </div>
          </div>

          <div className={FORM_OVERLAY_FOOTER}>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="h-9 w-full rounded-xl bg-[hsl(230_22%_62%)] text-sm font-bold text-white hover:bg-[hsl(230_22%_56%)] sm:h-10 sm:text-base"
            >
              {isSubmitting ? "Saving..." : "Add Card"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function AddCreditCardSheet({ open, onOpenChange }: AddCreditCardSheetProps) {
  if (!open) return null
  return <AddCreditCardSheetMounted onOpenChange={onOpenChange} />
}
